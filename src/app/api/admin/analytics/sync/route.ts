import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCampaignAnalytics } from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Sync analytics from Instantly to Supabase
export async function POST() {
  try {
    const supabase = getSupabase();

    // Fetch all analytics from Instantly
    const analytics = await getCampaignAnalytics();

    if (!analytics || analytics.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No analytics to sync",
        synced: 0,
      });
    }

    // Get campaign mapping (instantly_campaign_id -> local campaign_id)
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, instantly_campaign_id")
      .not("instantly_campaign_id", "is", null);

    const campaignMap = new Map(
      (campaigns || []).map((c) => [c.instantly_campaign_id, c.id])
    );

    let synced = 0;
    let failed = 0;

    for (const a of analytics) {
      const localCampaignId = campaignMap.get(a.campaign_id);

      // Use the upsert function
      const { error } = await supabase.rpc("upsert_analytics_snapshot", {
        p_instantly_campaign_id: a.campaign_id,
        p_campaign_id: localCampaignId || null,
        p_data: a,
      });

      if (error) {
        console.error("Error syncing analytics for", a.campaign_name, error);
        failed++;
      } else {
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      failed,
      total: analytics.length,
    });
  } catch (error) {
    console.error("Error syncing analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// GET - Get overview from stored analytics
export async function GET() {
  try {
    const supabase = getSupabase();

    // Try to get from analytics_overview view
    const { data: overview, error } = await supabase
      .from("analytics_overview")
      .select("*")
      .single();

    if (error) {
      // If view doesn't exist, fetch from Instantly directly
      const analytics = await getCampaignAnalytics();

      let totalLeads = 0;
      let totalEmailsSent = 0;
      let totalOpened = 0;
      let totalClicked = 0;
      let totalReplies = 0;

      analytics.forEach((a) => {
        totalLeads += a.leads_count || 0;
        totalEmailsSent += a.emails_sent_count || 0;
        totalOpened += a.open_count_unique || 0;
        totalClicked += a.link_click_count_unique || 0;
        totalReplies += a.reply_count_unique || 0;
      });

      return NextResponse.json({
        source: "instantly",
        total_campaigns: analytics.length,
        total_leads: totalLeads,
        total_emails_sent: totalEmailsSent,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        total_replies: totalReplies,
        overall_open_rate: totalEmailsSent > 0 ? (totalOpened / totalEmailsSent * 100).toFixed(2) : 0,
        overall_click_rate: totalEmailsSent > 0 ? (totalClicked / totalEmailsSent * 100).toFixed(2) : 0,
        overall_reply_rate: totalEmailsSent > 0 ? (totalReplies / totalEmailsSent * 100).toFixed(2) : 0,
      });
    }

    return NextResponse.json({
      source: "supabase",
      ...overview,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
