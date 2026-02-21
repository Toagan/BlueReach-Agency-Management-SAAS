// Diagnostic endpoint to check leads with replies
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import { requireCampaignAccess } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get campaign info
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, provider_type, provider_campaign_id, instantly_campaign_id, last_lead_sync_at")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Get leads with replies from database
  const { data: leadsWithReplies } = await supabase
    .from("leads")
    .select("id, email, first_name, last_name, status, is_positive_reply, has_replied, email_reply_count, metadata, provider_lead_id")
    .eq("campaign_id", campaignId)
    .or("has_replied.eq.true,email_reply_count.gt.0,is_positive_reply.eq.true")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Get positive leads count
  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_positive_reply", true);

  // Get replied leads count
  const { count: repliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("has_replied", true);

  // Get total leads count
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  // If SmartLead, fetch categories from API to compare
  let providerCategories: Array<{ email: string; category: string | null; is_interested: boolean }> = [];
  const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;

  if (campaign.provider_type === "smartlead" && providerCampaignId) {
    try {
      const provider = await getProviderForCampaign(campaignId);

      if ("fetchLeadStatistics" in provider) {
        const statsMap = await (provider as {
          fetchLeadStatistics: (id: string) => Promise<Map<string, { category: string | null; hasReplied: boolean }>>;
        }).fetchLeadStatistics(providerCampaignId);

        // Get top 20 leads with replies from provider stats
        for (const [email, stats] of statsMap) {
          if (stats.hasReplied || stats.category) {
            providerCategories.push({
              email,
              category: stats.category,
              is_interested: stats.category === "Interested" || stats.category === "Meeting Request",
            });
          }
          if (providerCategories.length >= 20) break;
        }
      }
    } catch (err) {
      console.error("Error fetching provider categories:", err);
    }
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      providerType: campaign.provider_type,
      providerCampaignId,
      lastSyncAt: campaign.last_lead_sync_at,
    },
    counts: {
      totalLeads: totalLeads || 0,
      repliedLeads: repliedCount || 0,
      positiveLeads: positiveCount || 0,
    },
    leadsWithReplies: (leadsWithReplies || []).map((lead) => ({
      email: lead.email,
      name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
      status: lead.status,
      isPositiveReply: lead.is_positive_reply,
      hasReplied: lead.has_replied,
      replyCount: lead.email_reply_count,
      providerLeadId: lead.provider_lead_id,
    })),
    providerCategories: providerCategories.length > 0 ? providerCategories : "Not fetched (run sync first or check SmartLead API)",
    diagnosis: {
      issue: positiveCount === 0 && repliedCount && repliedCount > 0
        ? "Leads have replied but none are marked as positive. Check SmartLead to ensure leads are categorized as 'Interested'."
        : positiveCount === 0 && repliedCount === 0
        ? "No replies detected. Run a sync to pull latest data from SmartLead."
        : "Everything looks normal.",
      recommendation: "To fix: 1) In SmartLead, mark the replied leads as 'Interested', 2) Run a sync in BlueReach to pull the updated categories.",
    },
  });
}
