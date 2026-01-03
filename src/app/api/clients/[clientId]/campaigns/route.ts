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

    // Aggregate stats from leads table by campaign_id
    const { data: leadStats, error: statsError } = await supabase
      .from("leads")
      .select("campaign_id, is_positive_reply, has_replied, status")
      .in("campaign_id", campaignIds);

    if (statsError) {
      console.error("Error fetching lead stats:", statsError);
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
        if (lead.has_replied || lead.status === "replied" || lead.status === "booked" || lead.status === "won" || lead.status === "lost") {
          stats.replied_count++;
        }
        if (lead.is_positive_reply) {
          stats.positive_count++;
        }
      }
    }

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

      const analytics = {
        leads_count: localStats.leads_count,
        emails_sent: emailsSent,
        emails_replied: repliesCount,
        emails_bounced: bounced,
        emails_opened: opened,
        total_opportunities: localStats.positive_count,
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
