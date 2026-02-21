import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import { ProviderError } from "@/lib/providers/types";
import { requireCampaignAccess } from "@/lib/auth";

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
    const auth = await requireCampaignAccess(campaignId);
    if (auth.error) return auth.error;
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
    const emailsSent = campaign.cached_emails_sent ?? 0;
    let analytics = {
      emails_sent: emailsSent,
      emails_opened: campaign.cached_emails_opened ?? 0,
      emails_replied: campaign.cached_reply_count ?? 0,
      emails_bounced: campaign.cached_emails_bounced ?? 0,
      open_rate:
        emailsSent > 0
          ? (campaign.cached_emails_opened || 0) / emailsSent
          : 0,
      reply_rate:
        emailsSent > 0
          ? (campaign.cached_reply_count || 0) / emailsSent
          : 0,
      bounce_rate:
        emailsSent > 0
          ? (campaign.cached_emails_bounced || 0) / emailsSent
          : 0,
      leads_count: 0, // Will be set from local DB below
      contacted_count: campaign.cached_contacted_count || emailsSent,
      total_opportunities: 0, // Will be set from local DB below
    };

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
    analytics.leads_count = localLeadsCount || 0;
    analytics.total_opportunities = localPositiveCount || 0;

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
          // If provider returns 404/410, the campaign was deleted - mark as inactive
          const isDeletedInProvider =
            (e instanceof ProviderError && (e.statusCode === 404 || e.statusCode === 410)) ||
            (e instanceof Error && (e.message.includes("not found") || e.message.includes("deleted")));

          if (isDeletedInProvider && campaign.is_active) {
            console.log(`[Campaign Details] Campaign ${campaignId} appears deleted in provider, marking inactive`);
            const { data: updated } = await supabase
              .from("campaigns")
              .update({ is_active: false })
              .eq("id", campaignId)
              .select()
              .single();

            if (updated) {
              updatedCampaign = updated;
            }
          } else {
            console.error("Failed to fetch campaign status:", e);
          }
        }

        // Fetch analytics from provider and update cache
        try {
          const providerAnalytics = await provider.fetchCampaignAnalytics(providerCampaignId);

          // Use emails_sent as fallback for contacted_count (contacted = emails sent to unique leads)
          const emailsSent = providerAnalytics.emailsSentCount || 0;
          const contactedCount = providerAnalytics.contactedCount || emailsSent;
          // Use local leads count as primary, provider as fallback
          const leadsCount = localLeadsCount || providerAnalytics.leadsCount || 0;

          analytics = {
            emails_sent: emailsSent,
            emails_opened: providerAnalytics.openCountUnique || 0,
            emails_replied: providerAnalytics.replyCount || 0,
            emails_bounced: providerAnalytics.bouncedCount || 0,
            open_rate:
              emailsSent > 0
                ? (providerAnalytics.openCountUnique || 0) / emailsSent
                : 0,
            reply_rate:
              emailsSent > 0
                ? (providerAnalytics.replyCount || 0) / emailsSent
                : 0,
            bounce_rate:
              emailsSent > 0
                ? (providerAnalytics.bouncedCount || 0) / emailsSent
                : 0,
            // Use local DB counts for leads and positive replies (source of truth after sync)
            leads_count: leadsCount,
            contacted_count: contactedCount,
            total_opportunities: localPositiveCount || providerAnalytics.totalOpportunities || 0,
          };

          // Update cache in database
          await supabase
            .from("campaigns")
            .update({
              cached_emails_sent: emailsSent,
              cached_emails_opened: providerAnalytics.openCountUnique || 0,
              cached_reply_count: providerAnalytics.replyCount || 0,
              cached_emails_bounced: providerAnalytics.bouncedCount || 0,
              cached_positive_count: localPositiveCount || providerAnalytics.totalOpportunities || 0,
              cached_leads_count: leadsCount,
              cached_contacted_count: contactedCount,
              cache_updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          console.log(`[Campaign Details] Refreshed analytics cache for ${campaignId}`);
        } catch (e) {
          console.error("Failed to fetch analytics from provider, recalculating from local DB:", e);

          // Provider unavailable (deleted campaign, API down, etc.)
          // Recalculate analytics from local leads table so data stays accurate
          const { count: localRepliedCount } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaignId)
            .eq("has_replied", true);

          const leadsCount = localLeadsCount || 0;
          const repliedCount = localRepliedCount || 0;
          const positiveCount = localPositiveCount || 0;
          // Preserve cached_emails_sent (from last successful provider sync) as contacted count
          const contactedCount = leadsCount;
          const sentCount = campaign.cached_emails_sent || leadsCount;

          analytics = {
            emails_sent: sentCount,
            emails_opened: campaign.cached_emails_opened ?? 0,
            emails_replied: repliedCount,
            emails_bounced: campaign.cached_emails_bounced ?? 0,
            open_rate: sentCount > 0 ? (campaign.cached_emails_opened || 0) / sentCount : 0,
            reply_rate: sentCount > 0 ? repliedCount / sentCount : 0,
            bounce_rate: sentCount > 0 ? (campaign.cached_emails_bounced || 0) / sentCount : 0,
            leads_count: leadsCount,
            contacted_count: contactedCount,
            total_opportunities: positiveCount,
          };

          // Update cache with corrected local counts
          await supabase
            .from("campaigns")
            .update({
              cached_reply_count: repliedCount,
              cached_positive_count: positiveCount,
              cached_leads_count: leadsCount,
              cached_contacted_count: contactedCount,
              cache_updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          console.log(`[Campaign Details] Recalculated from local DB for ${campaignId}: ${leadsCount} leads, ${repliedCount} replied, ${positiveCount} positive`);
        }
      } catch (e) {
        console.error("Failed to get provider for campaign:", e);
        // Provider not configured - recalculate from local DB
        const { count: localRepliedCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("has_replied", true);

        const repliedCount = localRepliedCount || 0;
        const positiveCount = localPositiveCount || 0;
        analytics.emails_replied = repliedCount;
        analytics.total_opportunities = positiveCount;
        analytics.leads_count = localLeadsCount || 0;
        analytics.contacted_count = localLeadsCount || 0;

        if (analytics.emails_sent > 0) {
          analytics.reply_rate = repliedCount / analytics.emails_sent;
        }
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
