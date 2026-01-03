import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCampaignAnalytics, getInstantlyClient } from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

// GET - Get campaigns for a client with analytics
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || "local"; // "local" (fast) or "instantly" (fresh)

    const supabase = getSupabase();

    // Get campaigns from local DB for this client
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("client_id", clientId)
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch campaigns" },
        { status: 500 }
      );
    }

    // Get campaign IDs for aggregation
    const campaignIds = campaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      return NextResponse.json({ campaigns: [], analyticsLoaded: true, clientStats: { replied: 0, positive: 0 } });
    }

    // Aggregate stats from leads table (FAST - local database)
    // Query by campaign_id for per-campaign stats
    const { data: leadStats, error: statsError } = await supabase
      .from("leads")
      .select("campaign_id, is_positive_reply, has_replied, status")
      .in("campaign_id", campaignIds);

    if (statsError) {
      console.error("Error fetching lead stats:", statsError);
    }

    // Query client-wide stats using count queries (more reliable)
    // Count positive replies
    const { count: clientPositive, error: positiveError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_positive_reply", true);

    if (positiveError) {
      console.error("Error counting positive leads:", positiveError);
    }

    // Count all replied leads (has_replied = true OR status in replied/booked/won/lost)
    const { count: clientReplied, error: repliedError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .or("has_replied.eq.true,status.eq.replied,status.eq.booked,status.eq.won,status.eq.lost");

    if (repliedError) {
      console.error("Error counting replied leads:", repliedError);
    }

    // Build stats map from local leads data
    const localStatsMap = new Map<string, {
      leads_count: number;
      replied_count: number;
      positive_count: number;
    }>();

    for (const campaignId of campaignIds) {
      localStatsMap.set(campaignId, { leads_count: 0, replied_count: 0, positive_count: 0 });
    }

    for (const lead of leadStats || []) {
      const stats = localStatsMap.get(lead.campaign_id);
      if (stats) {
        stats.leads_count++;
        if (lead.has_replied || lead.status === "replied") {
          stats.replied_count++;
        }
        if (lead.is_positive_reply) {
          stats.positive_count++;
        }
      }
    }

    // If source=instantly, also fetch from Instantly API for fresh data
    let instantlyAnalyticsMap = new Map<string, {
      emails_sent: number;
      bounced: number;
      open_count: number;
    }>();

    if (source === "instantly") {
      const instantlyClient = getInstantlyClient();
      if (instantlyClient.isConfigured()) {
        try {
          const analyticsData = await getCampaignAnalytics();
          for (const a of analyticsData) {
            instantlyAnalyticsMap.set(a.campaign_id, {
              emails_sent: a.emails_sent_count || 0,
              bounced: a.bounced_count || 0,
              open_count: a.open_count_unique || 0,
            });
          }
        } catch (e) {
          console.error("Failed to fetch Instantly analytics:", e);
        }
      }
    }

    // Build campaigns with analytics
    const campaignsWithAnalytics = campaigns.map((campaign) => {
      const localStats = localStatsMap.get(campaign.id) || {
        leads_count: 0,
        replied_count: 0,
        positive_count: 0,
      };

      const instantlyStats = campaign.instantly_campaign_id
        ? instantlyAnalyticsMap.get(campaign.instantly_campaign_id)
        : null;

      // Merge local + Instantly data
      const analytics = {
        leads_count: localStats.leads_count,
        emails_sent: instantlyStats?.emails_sent || localStats.leads_count,
        emails_replied: localStats.replied_count,
        emails_bounced: instantlyStats?.bounced || 0,
        emails_opened: instantlyStats?.open_count || 0,
        total_opportunities: localStats.positive_count,
        contacted_count: instantlyStats?.emails_sent || localStats.leads_count,
        reply_rate: localStats.leads_count > 0
          ? localStats.replied_count / localStats.leads_count
          : 0,
      };

      return {
        ...campaign,
        analytics,
      };
    });

    return NextResponse.json({
      campaigns: campaignsWithAnalytics,
      analyticsLoaded: true,
      source,
      // Client-wide stats (more reliable - counts all leads by client_id)
      clientStats: {
        replied: clientReplied ?? 0,
        positive: clientPositive ?? 0,
      },
    });
  } catch (error) {
    console.error("Error fetching client campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
