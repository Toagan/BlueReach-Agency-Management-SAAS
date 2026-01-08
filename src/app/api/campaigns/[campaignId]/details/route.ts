import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// Check if cache is stale (older than 1 hour)
function isCacheStale(cacheUpdatedAt: string | null): boolean {
  if (!cacheUpdatedAt) return true;
  const cacheTime = new Date(cacheUpdatedAt).getTime();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return cacheTime < oneHourAgo;
}

// GET - Get campaign details with analytics (CACHE-FIRST approach)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const supabase = getSupabase();

    // Get campaign from local DB
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Build analytics from cached values (ALWAYS read from cache first)
    // Note: leads_count and total_opportunities will be overwritten with local DB counts below
    const hasCachedData = campaign.cached_emails_sent !== null;
    let analytics = hasCachedData ? {
      emails_sent: campaign.cached_emails_sent || 0,
      emails_opened: campaign.cached_emails_opened || 0,
      emails_replied: campaign.cached_reply_count || 0,
      emails_bounced: campaign.cached_emails_bounced || 0,
      open_rate:
        campaign.cached_emails_sent > 0
          ? (campaign.cached_emails_opened || 0) / campaign.cached_emails_sent
          : 0,
      reply_rate:
        campaign.cached_emails_sent > 0
          ? (campaign.cached_reply_count || 0) / campaign.cached_emails_sent
          : 0,
      bounce_rate:
        campaign.cached_emails_sent > 0
          ? (campaign.cached_emails_bounced || 0) / campaign.cached_emails_sent
          : 0,
      leads_count: 0, // Will be set from local DB below
      contacted_count: campaign.cached_contacted_count || campaign.cached_emails_sent || 0,
      total_opportunities: 0, // Will be set from local DB below
    } : null;

    // Get local leads_count and positive_count from database
    const [{ count: localLeadsCount }, { count: localPositiveCount }] = await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("is_positive_reply", true),
    ]);

    // Use local counts as source of truth for leads_count and positive_count
    // Provider analytics are used for email metrics (sent, opened, replied, bounced)

    // Update analytics with local DB counts (source of truth for leads)
    if (analytics) {
      analytics.leads_count = localLeadsCount || 0;
      analytics.total_opportunities = localPositiveCount || 0;
    }

    let updatedCampaign = campaign;
    const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;
    const shouldRefresh = forceRefresh || isCacheStale(campaign.cache_updated_at);

    // Only fetch from provider if cache is stale or forced refresh
    if (providerCampaignId && shouldRefresh) {
      try {
        const provider = await getProviderForCampaign(campaignId);

        // Fetch campaign status from provider
        try {
          const providerCampaign = await provider.fetchCampaign(providerCampaignId);
          const isActive = providerCampaign.status === "active";

          // Update local DB if status changed
          if (campaign.is_active !== isActive) {
            const { data: updated } = await supabase
              .from("campaigns")
              .update({ is_active: isActive })
              .eq("id", campaignId)
              .select()
              .single();

            if (updated) {
              updatedCampaign = updated;
            }
          }
        } catch (e) {
          console.error("Failed to fetch campaign status:", e);
        }

        // Fetch analytics from provider and update cache
        try {
          const providerAnalytics = await provider.fetchCampaignAnalytics(providerCampaignId);

          analytics = {
            emails_sent: providerAnalytics.emailsSentCount || 0,
            emails_opened: providerAnalytics.openCountUnique || 0,
            emails_replied: providerAnalytics.replyCount || 0,
            emails_bounced: providerAnalytics.bouncedCount || 0,
            open_rate:
              providerAnalytics.emailsSentCount > 0
                ? (providerAnalytics.openCountUnique || 0) / providerAnalytics.emailsSentCount
                : 0,
            reply_rate:
              providerAnalytics.emailsSentCount > 0
                ? (providerAnalytics.replyCount || 0) / providerAnalytics.emailsSentCount
                : 0,
            bounce_rate:
              providerAnalytics.emailsSentCount > 0
                ? (providerAnalytics.bouncedCount || 0) / providerAnalytics.emailsSentCount
                : 0,
            // Use local DB counts for leads and positive replies (source of truth after sync)
            leads_count: localLeadsCount || providerAnalytics.leadsCount || 0,
            contacted_count: providerAnalytics.contactedCount || 0,
            total_opportunities: localPositiveCount || providerAnalytics.totalOpportunities || 0,
          };

          // Update cache in database
          await supabase
            .from("campaigns")
            .update({
              cached_emails_sent: providerAnalytics.emailsSentCount || 0,
              cached_emails_opened: providerAnalytics.openCountUnique || 0,
              cached_reply_count: providerAnalytics.replyCount || 0,
              cached_emails_bounced: providerAnalytics.bouncedCount || 0,
              cached_positive_count: providerAnalytics.totalOpportunities || 0,
              cached_leads_count: providerAnalytics.leadsCount || 0,
              cached_contacted_count: providerAnalytics.contactedCount || 0,
              cache_updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          console.log(`[Campaign Details] Refreshed analytics cache for ${campaignId}`);
        } catch (e) {
          console.error("Failed to fetch analytics from provider:", e);
          // Keep using cached analytics if provider fetch fails
        }
      } catch (e) {
        console.error("Failed to get provider for campaign:", e);
        // Keep using cached analytics if provider is unavailable
      }
    }

    return NextResponse.json({
      campaign: updatedCampaign,
      analytics,
      localLeadsCount: localLeadsCount || 0,
      cacheInfo: {
        isCached: !shouldRefresh,
        lastUpdated: campaign.cache_updated_at,
        refreshedNow: shouldRefresh && providerCampaignId,
      },
    });
  } catch (error) {
    console.error("Error fetching campaign details:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
