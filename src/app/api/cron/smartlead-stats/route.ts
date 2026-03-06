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

// GET/POST - Cron job to sync Smartlead campaign stats (cached counters)
// Lightweight: only 2 API calls per campaign (analytics + campaign status)
// Should run every 4-6 hours for active campaigns
export async function GET(request: NextRequest) {
  return handleStatsSync(request);
}

export async function POST(request: NextRequest) {
  return handleStatsSync(request);
}

async function handleStatsSync(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Verify cron secret
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional: only sync a specific campaign
    const campaignId = searchParams.get("campaign_id");

    const supabase = getSupabase();

    // Get active Smartlead campaigns with API keys
    let query = supabase
      .from("campaigns")
      .select("id, name, provider_campaign_id, api_key_encrypted, client_id, is_active")
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

    console.log(`[Smartlead Stats] Syncing ${campaigns.length} campaigns`);

    let campaignsProcessed = 0;
    let campaignsFailed = 0;
    const results: Array<{ campaign: string; sent: number; replies: number; bounced: number; error?: string }> = [];

    for (const campaign of campaigns) {
      try {
        const provider = createProvider("smartlead", campaign.api_key_encrypted!);

        // fetchCampaignAnalytics = 2 lightweight API calls (analytics + campaign details)
        const analytics = await provider.fetchCampaignAnalytics(
          campaign.provider_campaign_id!
        );

        // Count local replied leads (more accurate than provider for positive count)
        const { count: localReplyCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .or("has_replied.eq.true,status.eq.replied,status.eq.booked,status.eq.won,status.eq.lost");

        // Use the higher of provider reply count vs local reply count
        const replyCount = Math.max(
          analytics.replyCount || 0,
          localReplyCount || 0
        );

        await supabase
          .from("campaigns")
          .update({
            cached_emails_sent: analytics.emailsSentCount || 0,
            cached_emails_opened: analytics.openCountUnique || 0,
            cached_reply_count: replyCount,
            cached_emails_bounced: analytics.bouncedCount || 0,
            cached_leads_count: analytics.leadsCount || 0,
            cached_contacted_count: analytics.contactedCount || 0,
            cache_updated_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);

        console.log(
          `[Smartlead Stats] ${campaign.name}: ${analytics.emailsSentCount} sent, ${replyCount} replies, ${analytics.bouncedCount} bounced`
        );

        results.push({
          campaign: campaign.name,
          sent: analytics.emailsSentCount || 0,
          replies: replyCount,
          bounced: analytics.bouncedCount || 0,
        });

        campaignsProcessed++;

        // Rate limit between campaigns
        await delay(200);
      } catch (campaignError) {
        console.error(`[Smartlead Stats] Error for ${campaign.name}:`, campaignError);
        campaignsFailed++;
        results.push({
          campaign: campaign.name,
          sent: 0,
          replies: 0,
          bounced: 0,
          error: campaignError instanceof Error ? campaignError.message : "Unknown error",
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Smartlead Stats] Complete: ${campaignsProcessed} synced, ${campaignsFailed} failed in ${elapsed}s`
    );

    return NextResponse.json({
      success: true,
      campaignsProcessed,
      campaignsFailed,
      totalCampaigns: campaigns.length,
      elapsedSeconds: parseFloat(elapsed),
      results,
    });
  } catch (error) {
    console.error("[Smartlead Stats] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stats sync failed" },
      { status: 500 }
    );
  }
}
