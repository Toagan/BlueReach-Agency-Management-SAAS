import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getDailyAnalytics } from "@/lib/instantly/analytics";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to delay between API calls (rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// POST - Backfill historical daily analytics from Instantly
export async function POST() {
  try {
    const supabase = getSupabase();

    // Get all campaigns with Instantly integration
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id")
      .not("instantly_campaign_id", "is", null);

    if (campaignsError) {
      return NextResponse.json(
        { error: "Failed to fetch campaigns: " + campaignsError.message },
        { status: 500 }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No campaigns with Instantly integration found",
        campaignsProcessed: 0,
        recordsInserted: 0,
      });
    }

    console.log(`[Backfill] Processing ${campaigns.length} campaigns`);

    let totalRecordsInserted = 0;
    let campaignsProcessed = 0;
    let campaignsFailed = 0;
    const errors: Array<{ campaign: string; error: string }> = [];
    let earliestDate: string | null = null;
    let latestDate: string | null = null;

    for (const campaign of campaigns) {
      try {
        console.log(`[Backfill] Fetching daily analytics for: ${campaign.name}`);

        // Fetch ALL historical daily analytics (no date filter)
        const dailyAnalytics = await getDailyAnalytics({
          campaign_id: campaign.instantly_campaign_id!,
        });

        if (!dailyAnalytics || dailyAnalytics.length === 0) {
          console.log(`[Backfill] No daily analytics for: ${campaign.name}`);
          campaignsProcessed++;
          continue;
        }

        console.log(`[Backfill] Got ${dailyAnalytics.length} daily records for: ${campaign.name}`);

        // Prepare records for upsert
        const records = dailyAnalytics.map((day) => ({
          campaign_id: campaign.id,
          snapshot_date: day.date,
          emails_sent: day.sent || 0,
          emails_opened: day.opened || 0,
          emails_opened_unique: day.unique_opened || 0,
          emails_clicked: day.clicks || 0,
          emails_clicked_unique: day.unique_clicks || 0,
          emails_replied: day.replies || 0,
          emails_replied_unique: day.unique_replies || 0,
          leads_contacted: day.contacted || 0,
          positive_replies: day.opportunities || 0,
          updated_at: new Date().toISOString(),
        }));

        // Track date range
        for (const record of records) {
          if (!earliestDate || record.snapshot_date < earliestDate) {
            earliestDate = record.snapshot_date;
          }
          if (!latestDate || record.snapshot_date > latestDate) {
            latestDate = record.snapshot_date;
          }
        }

        // Upsert in batches of 100
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          const { error: upsertError } = await supabase
            .from("campaign_analytics_daily")
            .upsert(batch, {
              onConflict: "campaign_id,snapshot_date",
            });

          if (upsertError) {
            throw new Error(`Upsert failed: ${upsertError.message}`);
          }
        }

        totalRecordsInserted += records.length;
        campaignsProcessed++;

        // Rate limit: wait 100ms between campaigns
        await delay(100);
      } catch (campaignError) {
        console.error(`[Backfill] Error processing campaign ${campaign.name}:`, campaignError);
        campaignsFailed++;
        errors.push({
          campaign: campaign.name,
          error: campaignError instanceof Error ? campaignError.message : "Unknown error",
        });
      }
    }

    console.log(`[Backfill] Complete: ${campaignsProcessed} campaigns, ${totalRecordsInserted} records`);

    return NextResponse.json({
      success: true,
      message: `Backfill complete`,
      campaignsProcessed,
      campaignsFailed,
      totalCampaigns: campaigns.length,
      recordsInserted: totalRecordsInserted,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}

// GET - Check backfill status (count of daily records)
export async function GET() {
  try {
    const supabase = getSupabase();

    // Count total records
    const { count: totalRecords } = await supabase
      .from("campaign_analytics_daily")
      .select("*", { count: "exact", head: true });

    // Get date range
    const { data: dateRange } = await supabase
      .from("campaign_analytics_daily")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabase
      .from("campaign_analytics_daily")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);

    // Count campaigns with data
    const { data: campaignCounts } = await supabase
      .from("campaign_analytics_daily")
      .select("campaign_id")
      .limit(1000);

    const uniqueCampaigns = new Set(campaignCounts?.map((c) => c.campaign_id) || []);

    return NextResponse.json({
      totalRecords: totalRecords || 0,
      campaignsWithData: uniqueCampaigns.size,
      dateRange: {
        earliest: dateRange?.[0]?.snapshot_date || null,
        latest: latestDate?.[0]?.snapshot_date || null,
      },
    });
  } catch (error) {
    console.error("[Backfill Status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
