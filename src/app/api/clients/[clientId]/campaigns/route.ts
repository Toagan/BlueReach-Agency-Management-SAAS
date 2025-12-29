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

// GET - Get campaigns for a client with Instantly analytics
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

    // Check if Instantly API is configured
    const instantlyClient = getInstantlyClient();
    if (!instantlyClient.isConfigured()) {
      // Return campaigns without analytics
      return NextResponse.json({
        campaigns: campaigns.map((c) => ({ ...c, analytics: null })),
      });
    }

    // Fetch analytics from Instantly
    let analyticsData: Awaited<ReturnType<typeof getCampaignAnalytics>> = [];
    try {
      analyticsData = await getCampaignAnalytics();
    } catch (e) {
      console.error("Failed to fetch Instantly analytics:", e);
    }

    // Map analytics to campaigns with transformed field names
    const analyticsMap = new Map(
      analyticsData.map((a) => [a.campaign_id, a])
    );

    const campaignsWithAnalytics = campaigns.map((campaign) => {
      const rawAnalytics = campaign.instantly_campaign_id
        ? analyticsMap.get(campaign.instantly_campaign_id)
        : null;

      // Transform Instantly field names to what the dashboard expects
      const analytics = rawAnalytics
        ? {
            emails_sent: rawAnalytics.emails_sent_count || 0,
            emails_opened: rawAnalytics.open_count_unique || 0,
            emails_replied: rawAnalytics.reply_count_unique || 0,
            emails_bounced: rawAnalytics.bounced_count || 0,
            open_rate:
              rawAnalytics.emails_sent_count > 0
                ? (rawAnalytics.open_count_unique || 0) / rawAnalytics.emails_sent_count
                : 0,
            reply_rate:
              rawAnalytics.emails_sent_count > 0
                ? (rawAnalytics.reply_count_unique || 0) / rawAnalytics.emails_sent_count
                : 0,
            bounce_rate:
              rawAnalytics.emails_sent_count > 0
                ? (rawAnalytics.bounced_count || 0) / rawAnalytics.emails_sent_count
                : 0,
            // Include additional useful metrics
            leads_count: rawAnalytics.leads_count || 0,
            contacted_count: rawAnalytics.contacted_count || 0,
            total_opportunities: rawAnalytics.total_opportunities || 0,
          }
        : null;

      return {
        ...campaign,
        analytics,
      };
    });

    return NextResponse.json({ campaigns: campaignsWithAnalytics });
  } catch (error) {
    console.error("Error fetching client campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
