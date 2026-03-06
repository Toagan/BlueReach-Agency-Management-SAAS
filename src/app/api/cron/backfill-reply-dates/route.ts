import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createProvider } from "@/lib/providers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// POST - One-time backfill of responded_at from Smartlead reply_time
// Fetches /statistics endpoint for each Smartlead campaign and updates leads
export const maxDuration = 300; // 5 min timeout

export async function GET(request: NextRequest) {
  return handleBackfill(request);
}

export async function POST(request: NextRequest) {
  return handleBackfill(request);
}

async function handleBackfill(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Verify cron secret
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional: only backfill a specific campaign
    const campaignId = searchParams.get("campaign_id");

    const supabase = getSupabase();

    // Get Smartlead campaigns with API keys
    let query = supabase
      .from("campaigns")
      .select("id, name, provider_campaign_id, api_key_encrypted")
      .eq("provider_type", "smartlead")
      .not("provider_campaign_id", "is", null)
      .not("api_key_encrypted", "is", null);

    if (campaignId) {
      query = query.eq("id", campaignId);
    }

    const { data: campaigns, error: campaignsError } = await query;

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
      });
    }

    console.log(`[Backfill Reply Dates] Processing ${campaigns.length} campaigns`);

    const results: Array<{
      campaign: string;
      leadsUpdated: number;
      leadsSkipped: number;
      error?: string;
    }> = [];

    for (const campaign of campaigns) {
      try {
        console.log(`[Backfill Reply Dates] Processing: ${campaign.name}`);

        const provider = createProvider("smartlead", campaign.api_key_encrypted!);

        // Use the provider's fetchLeadStatistics which already handles pagination
        type StatsMap = Map<string, { category: string | null; openCount: number; clickCount: number; hasReplied: boolean; replyTime: string | null }>;
        const statsMap = await (provider as unknown as { fetchLeadStatistics: (id: string) => Promise<StatsMap> }).fetchLeadStatistics(
          campaign.provider_campaign_id!
        );

        // Get leads for this campaign that have replied but no responded_at
        const { data: leads, error: leadsError } = await supabase
          .from("leads")
          .select("id, email, responded_at, has_replied, is_positive_reply")
          .eq("campaign_id", campaign.id);

        if (leadsError || !leads) {
          console.error(`[Backfill Reply Dates] Error fetching leads for ${campaign.name}:`, leadsError);
          results.push({
            campaign: campaign.name,
            leadsUpdated: 0,
            leadsSkipped: 0,
            error: leadsError?.message || "No leads found",
          });
          continue;
        }

        let updated = 0;
        let skipped = 0;

        // Build batch updates
        for (const lead of leads) {
          const emailLower = lead.email?.toLowerCase();
          if (!emailLower) continue;

          const stats = statsMap.get(emailLower);
          if (!stats || !stats.replyTime) {
            skipped++;
            continue;
          }

          // Only update if responded_at is not already set
          if (lead.responded_at) {
            skipped++;
            continue;
          }

          const { error: updateError } = await supabase
            .from("leads")
            .update({ responded_at: stats.replyTime })
            .eq("id", lead.id);

          if (updateError) {
            console.error(`[Backfill Reply Dates] Error updating lead ${lead.email}:`, updateError);
          } else {
            updated++;
          }
        }

        console.log(
          `[Backfill Reply Dates] ${campaign.name}: ${updated} updated, ${skipped} skipped`
        );

        results.push({
          campaign: campaign.name,
          leadsUpdated: updated,
          leadsSkipped: skipped,
        });

        // Rate limit between campaigns
        await delay(2000);
      } catch (campaignError) {
        console.error(`[Backfill Reply Dates] Error for ${campaign.name}:`, campaignError);
        results.push({
          campaign: campaign.name,
          leadsUpdated: 0,
          leadsSkipped: 0,
          error: campaignError instanceof Error ? campaignError.message : "Unknown error",
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalUpdated = results.reduce((sum, r) => sum + r.leadsUpdated, 0);

    console.log(
      `[Backfill Reply Dates] Complete: ${totalUpdated} leads updated in ${elapsed}s`
    );

    return NextResponse.json({
      success: true,
      totalLeadsUpdated: totalUpdated,
      elapsedSeconds: parseFloat(elapsed),
      results,
    });
  } catch (error) {
    console.error("[Backfill Reply Dates] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
