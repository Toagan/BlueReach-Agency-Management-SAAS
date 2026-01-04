import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

// GET - Get campaigns for a client with analytics (ALL DATA FROM SUPABASE ONLY)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { clientId } = await params;
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
      return NextResponse.json({
        campaigns: [],
        analyticsLoaded: true,
        clientStats: { replied: 0, positive: 0 },
      });
    }

    // Count positive replies for client
    const { count: clientPositive } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_positive_reply", true);

    // Count all replied leads
    const { count: clientReplied } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .or("has_replied.eq.true,status.eq.replied,status.eq.booked,status.eq.won,status.eq.lost");

    // Build stats map using COUNT queries (more efficient than fetching all leads)
    const localStatsMap = new Map<string, {
      leads_count: number;
      replied_count: number;
      positive_count: number;
    }>();

    // Get counts for each campaign using parallel queries
    await Promise.all(
      campaignIds.map(async (campaignId) => {
        const [totalResult, repliedResult, positiveResult] = await Promise.all([
          // Total leads count
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaignId),
          // Replied leads count
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaignId)
            .or("has_replied.eq.true,status.eq.replied,status.eq.booked,status.eq.won,status.eq.lost"),
          // Positive leads count
          supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaignId)
            .eq("is_positive_reply", true),
        ]);

        localStatsMap.set(campaignId, {
          leads_count: totalResult.count || 0,
          replied_count: repliedResult.count || 0,
          positive_count: positiveResult.count || 0,
        });
      })
    );

    // Build campaigns with analytics - ALL FROM SUPABASE
    const campaignsWithAnalytics = campaigns.map((campaign) => {
      const localStats = localStatsMap.get(campaign.id) || {
        leads_count: 0,
        replied_count: 0,
        positive_count: 0,
      };

      // Use cached values from campaign sync, fallback to local leads count
      const emailsSent = campaign.cached_emails_sent || localStats.leads_count;
      const repliesCount = campaign.cached_reply_count || localStats.replied_count;
      const bounced = campaign.cached_emails_bounced || 0;
      const opened = campaign.cached_emails_opened || 0;
      // Use cached positive count from provider, fallback to local leads count
      const positiveCount = campaign.cached_positive_count || localStats.positive_count;

      const analytics = {
        leads_count: localStats.leads_count,
        emails_sent: emailsSent,
        emails_replied: repliesCount,
        emails_bounced: bounced,
        emails_opened: opened,
        total_opportunities: positiveCount,
        contacted_count: emailsSent,
        reply_rate: emailsSent > 0 ? repliesCount / emailsSent : 0,
        bounce_rate: emailsSent > 0 ? bounced / emailsSent : 0,
      };

      return {
        ...campaign,
        analytics,
      };
    });

    return NextResponse.json({
      campaigns: campaignsWithAnalytics,
      analyticsLoaded: true,
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
