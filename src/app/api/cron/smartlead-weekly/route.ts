import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getProviderForCampaign } from "@/lib/providers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to delay between API calls (rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// GET/POST - Weekly cron job to backfill Smartlead analytics
// Processes campaigns one at a time, saves incrementally
export async function GET(request: NextRequest) {
  return handleWeeklyBackfill(request);
}

export async function POST(request: NextRequest) {
  return handleWeeklyBackfill(request);
}

async function handleWeeklyBackfill(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Verify cron secret
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Get all Smartlead campaigns with API keys
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, provider_campaign_id, api_key_encrypted, client_id, provider_type")
      .eq("provider_type", "smartlead")
      .not("provider_campaign_id", "is", null)
      .not("api_key_encrypted", "is", null);

    if (campaignsError) {
      return NextResponse.json(
        { error: "Failed to fetch campaigns: " + campaignsError.message },
        { status: 500 }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Smartlead campaigns found",
        campaignsProcessed: 0,
        recordsUpserted: 0,
      });
    }

    console.log(`[Smartlead Weekly] Processing ${campaigns.length} Smartlead campaigns`);

    let totalRecordsUpserted = 0;
    let campaignsProcessed = 0;
    let campaignsFailed = 0;
    const results: Array<{ campaign: string; records: number; error?: string }> = [];

    // Process each campaign
    for (const campaign of campaigns) {
      const campaignStart = Date.now();

      try {
        console.log(`[Smartlead Weekly] Starting: ${campaign.name}`);

        // Get provider for this campaign
        const provider = await getProviderForCampaign(campaign.id);

        if (!provider.fetchDailyAnalytics) {
          console.log(`[Smartlead Weekly] Skipping ${campaign.name} - no daily analytics support`);
          continue;
        }

        // Fetch ALL daily analytics (wide date range)
        const dailyAnalytics = await provider.fetchDailyAnalytics(
          campaign.provider_campaign_id!,
          "2020-01-01",
          "2030-12-31"
        );

        if (!dailyAnalytics || dailyAnalytics.length === 0) {
          console.log(`[Smartlead Weekly] No data for: ${campaign.name}`);
          results.push({ campaign: campaign.name, records: 0 });
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

        const elapsed = ((Date.now() - campaignStart) / 1000).toFixed(1);
        console.log(`[Smartlead Weekly] Completed ${campaign.name}: ${records.length} records in ${elapsed}s`);

        totalRecordsUpserted += records.length;
        campaignsProcessed++;
        results.push({ campaign: campaign.name, records: records.length });

        // Small delay between campaigns
        await delay(100);

      } catch (campaignError) {
        console.error(`[Smartlead Weekly] Error for ${campaign.name}:`, campaignError);
        campaignsFailed++;
        results.push({
          campaign: campaign.name,
          records: 0,
          error: campaignError instanceof Error ? campaignError.message : "Unknown error",
        });
      }
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Smartlead Weekly] Complete: ${campaignsProcessed} campaigns, ${totalRecordsUpserted} records in ${totalElapsed}s`);

    return NextResponse.json({
      success: true,
      message: "Smartlead weekly backfill complete",
      campaignsProcessed,
      campaignsFailed,
      totalCampaigns: campaigns.length,
      recordsUpserted: totalRecordsUpserted,
      elapsedSeconds: parseFloat(totalElapsed),
      results,
    });

  } catch (error) {
    console.error("[Smartlead Weekly] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Weekly backfill failed" },
      { status: 500 }
    );
  }
}
