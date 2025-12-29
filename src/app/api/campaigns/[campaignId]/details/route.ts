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
  params: Promise<{ campaignId: string }>;
}

// GET - Get campaign details with analytics
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
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

    // Check if Instantly API is configured
    const instantlyClient = getInstantlyClient();
    let analytics = null;

    if (instantlyClient.isConfigured() && campaign.instantly_campaign_id) {
      try {
        const analyticsData = await getCampaignAnalytics({
          id: campaign.instantly_campaign_id,
        });

        if (analyticsData.length > 0) {
          const rawAnalytics = analyticsData[0];
          analytics = {
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
            leads_count: rawAnalytics.leads_count || 0,
            contacted_count: rawAnalytics.contacted_count || 0,
            total_opportunities: rawAnalytics.total_opportunities || 0,
          };
        }
      } catch (e) {
        console.error("Failed to fetch Instantly analytics:", e);
      }
    }

    return NextResponse.json({ campaign, analytics });
  } catch (error) {
    console.error("Error fetching campaign details:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
