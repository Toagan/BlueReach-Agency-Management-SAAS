import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getDailyAnalytics } from "@/lib/instantly/analytics";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Helper to delay between API calls (rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// GET/POST - Daily cron job to snapshot analytics from Instantly
export async function GET(request: NextRequest) {
  return handleSnapshot(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshot(request);
}

async function handleSnapshot(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Verify cron secret for security
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Calculate date range: last 3 days to today (to catch any delayed data)
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const startDate = formatDate(threeDaysAgo);
    const endDate = formatDate(today);

    console.log(`[Analytics Snapshot] Running for ${startDate} to ${endDate}`);

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
        message: "No campaigns with Instantly integration",
        campaignsProcessed: 0,
        recordsUpserted: 0,
      });
    }

    console.log(`[Analytics Snapshot] Processing ${campaigns.length} campaigns`);

    let totalRecordsUpserted = 0;
    let campaignsProcessed = 0;
    let campaignsFailed = 0;
    const errors: Array<{ campaign: string; error: string }> = [];

    for (const campaign of campaigns) {
      try {
        // Fetch daily analytics for the date range
        const dailyAnalytics = await getDailyAnalytics({
          campaign_id: campaign.instantly_campaign_id!,
          start_date: startDate,
          end_date: endDate,
        });

        if (!dailyAnalytics || dailyAnalytics.length === 0) {
          campaignsProcessed++;
          continue;
        }

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

        // Upsert records
        const { error: upsertError } = await supabase
          .from("campaign_analytics_daily")
          .upsert(records, {
            onConflict: "campaign_id,snapshot_date",
          });

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        totalRecordsUpserted += records.length;
        campaignsProcessed++;

        // Rate limit: wait 50ms between campaigns
        await delay(50);
      } catch (campaignError) {
        console.error(`[Analytics Snapshot] Error for ${campaign.name}:`, campaignError);
        campaignsFailed++;
        errors.push({
          campaign: campaign.name,
          error: campaignError instanceof Error ? campaignError.message : "Unknown error",
        });
      }
    }

    console.log(`[Analytics Snapshot] Complete: ${campaignsProcessed} campaigns, ${totalRecordsUpserted} records`);

    return NextResponse.json({
      success: true,
      message: `Daily snapshot complete`,
      dateRange: { start: startDate, end: endDate },
      campaignsProcessed,
      campaignsFailed,
      totalCampaigns: campaigns.length,
      recordsUpserted: totalRecordsUpserted,
      errors: errors.length > 0 ? errors : undefined,
      version: "v1",
    });
  } catch (error) {
    console.error("[Analytics Snapshot] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Snapshot failed" },
      { status: 500 }
    );
  }
}
