// Recalculate campaign analytics from local leads table
// Used when the provider campaign has been deleted or when cached data is stale/corrupted

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCampaignAccess } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;
  const supabase = getSupabase();

  try {
    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, cached_emails_sent, cached_emails_opened, cached_reply_count, cached_emails_bounced, cached_positive_count, cached_leads_count, cached_contacted_count")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Count all metrics from the leads table
    const [
      { count: totalLeads },
      { count: repliedCount },
      { count: positiveCount },
      { count: bouncedCount },
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("has_replied", true),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("is_positive_reply", true),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .gt("email_reply_count", 0)
        .eq("status", "bounced"),
    ]);

    // Sum email metrics from leads
    const { data: emailMetrics } = await supabase
      .from("leads")
      .select("email_open_count, email_click_count, email_reply_count")
      .eq("campaign_id", campaignId);

    let totalOpens = 0;
    let totalClicks = 0;
    let totalEmailsSent = 0;

    // Count leads with any engagement as "contacted"
    let contactedCount = 0;

    (emailMetrics || []).forEach((lead) => {
      totalOpens += lead.email_open_count || 0;
      totalClicks += lead.email_click_count || 0;
      // Each lead was sent at least 1 email if they exist in the campaign
      contactedCount++;
    });

    // Use the higher of: existing cached_emails_sent or contacted leads count
    // (cached_emails_sent may include multi-step sequences)
    totalEmailsSent = Math.max(campaign.cached_emails_sent || 0, contactedCount);

    // Count bounced emails from lead_emails table
    const { count: bouncedEmailCount } = await supabase
      .from("lead_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("direction", "outbound")
      .not("sent_at", "is", null);

    const updates = {
      cached_leads_count: totalLeads || 0,
      cached_contacted_count: contactedCount,
      cached_emails_sent: totalEmailsSent,
      cached_emails_opened: totalOpens,
      cached_reply_count: repliedCount || 0,
      cached_positive_count: positiveCount || 0,
      cached_emails_bounced: bouncedCount || 0,
      cache_updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", campaignId);

    if (updateError) {
      console.error("[Recalculate] Error updating campaign:", updateError);
      return NextResponse.json(
        { error: "Failed to update campaign" },
        { status: 500 }
      );
    }

    console.log(`[Recalculate] Updated campaign ${campaignId} (${campaign.name}):`, updates);

    return NextResponse.json({
      success: true,
      campaignName: campaign.name,
      previous: {
        cached_emails_sent: campaign.cached_emails_sent,
        cached_emails_opened: campaign.cached_emails_opened,
        cached_reply_count: campaign.cached_reply_count,
        cached_emails_bounced: campaign.cached_emails_bounced,
        cached_positive_count: campaign.cached_positive_count,
        cached_leads_count: campaign.cached_leads_count,
        cached_contacted_count: campaign.cached_contacted_count,
      },
      updated: updates,
    });
  } catch (error) {
    console.error("[Recalculate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recalculate" },
      { status: 500 }
    );
  }
}
