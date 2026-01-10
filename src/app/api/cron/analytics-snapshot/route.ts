import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getProviderForCampaign } from "@/lib/providers";

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
// Supports per-campaign API keys
export async function GET(request: NextRequest) {
  return handleSnapshot(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshot(request);
}

async function handleSnapshot(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Verify cron secret for security (skip for local testing)
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

    // Get all campaigns with provider integration and API keys
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, provider_campaign_id, instantly_campaign_id, api_key_encrypted")
      .or("provider_campaign_id.not.is.null,instantly_campaign_id.not.is.null");

    if (campaignsError) {
      return NextResponse.json(
        { error: "Failed to fetch campaigns: " + campaignsError.message },
        { status: 500 }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No campaigns with provider integration",
        campaignsProcessed: 0,
        recordsUpserted: 0,
      });
    }

    console.log(`[Analytics Snapshot] Processing ${campaigns.length} campaigns`);

    let totalRecordsUpserted = 0;
    let campaignsProcessed = 0;
    let campaignsSkipped = 0;
    let campaignsFailed = 0;
    const errors: Array<{ campaign: string; error: string }> = [];

    for (const campaign of campaigns) {
      try {
        const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;

        // Skip campaigns without API key
        if (!campaign.api_key_encrypted) {
          campaignsSkipped++;
          continue;
        }

        // Get provider for this campaign (uses per-campaign API key)
        const provider = await getProviderForCampaign(campaign.id);

        // Only process Instantly campaigns with daily analytics support
        if (provider.providerType !== "instantly" || !provider.fetchDailyAnalytics) {
          campaignsSkipped++;
          continue;
        }

        // Fetch daily analytics for the date range
        const dailyAnalytics = await provider.fetchDailyAnalytics(
          providerCampaignId!,
          startDate,
          endDate
        );

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
          emails_opened_unique: day.uniqueOpened || 0,
          emails_clicked: day.clicked || 0,
          emails_clicked_unique: day.uniqueClicked || 0,
          emails_replied: day.replied || 0,
          emails_replied_unique: day.uniqueReplied || 0,
          leads_contacted: day.sent || 0,
          positive_replies: 0,
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

    console.log(`[Analytics Snapshot] Complete: ${campaignsProcessed} processed, ${campaignsSkipped} skipped, ${totalRecordsUpserted} records`);

    return NextResponse.json({
      success: true,
      message: `Daily snapshot complete`,
      dateRange: { start: startDate, end: endDate },
      campaignsProcessed,
      campaignsSkipped,
      campaignsFailed,
      totalCampaigns: campaigns.length,
      recordsUpserted: totalRecordsUpserted,
      errors: errors.length > 0 ? errors : undefined,
      version: "v2",
    });
  } catch (error) {
    console.error("[Analytics Snapshot] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Snapshot failed" },
      { status: 500 }
    );
  }
}
