// Historical Lead Sync Endpoint
// Pulls ALL leads from the provider API and upserts them into Supabase

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import type { ProviderLead } from "@/lib/providers/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  // Use service role to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, client_id, name, provider_type, provider_campaign_id, instantly_campaign_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get client name for denormalization
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", campaign.client_id)
      .single();

    // Get provider instance
    const provider = await getProviderForCampaign(campaignId);

    // Get the provider campaign ID
    const providerCampaignId =
      campaign.provider_campaign_id || campaign.instantly_campaign_id;

    if (!providerCampaignId) {
      return NextResponse.json(
        { error: "Campaign not linked to provider" },
        { status: 400 }
      );
    }

    console.log(
      `[SyncLeads] Starting sync for campaign ${campaignId} (${provider.providerType})`
    );

    // Fetch ALL leads from provider
    const providerLeads = await provider.fetchAllLeads(providerCampaignId);

    console.log(`[SyncLeads] Fetched ${providerLeads.length} leads from provider`);

    // Get existing leads for this campaign
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("email, provider_lead_id, instantly_lead_id")
      .eq("campaign_id", campaignId);

    const existingByEmail = new Map<string, { provider_lead_id?: string; instantly_lead_id?: string }>();
    const existingByProviderId = new Map<string, boolean>();

    (existingLeads || []).forEach((lead) => {
      existingByEmail.set(lead.email.toLowerCase(), lead);
      if (lead.provider_lead_id) {
        existingByProviderId.set(lead.provider_lead_id, true);
      }
      if (lead.instantly_lead_id) {
        existingByProviderId.set(lead.instantly_lead_id, true);
      }
    });

    // Prepare upsert data
    const leadsToInsert: Array<Record<string, unknown>> = [];
    const leadsToUpdate: Array<{ email: string; data: Record<string, unknown> }> = [];

    for (const lead of providerLeads) {
      const emailLower = lead.email.toLowerCase();
      const existing = existingByEmail.get(emailLower);

      const leadData: Record<string, unknown> = {
        campaign_id: campaignId,
        client_id: campaign.client_id,
        client_name: client?.name,
        campaign_name: campaign.name,
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        company_name: lead.companyName,
        company_domain: lead.companyDomain,
        phone: lead.phone,
        linkedin_url: lead.linkedinUrl,
        website: lead.website,
        provider_type: provider.providerType,
        provider_lead_id: lead.id,
        email_open_count: lead.emailOpenCount || 0,
        email_click_count: lead.emailClickCount || 0,
        email_reply_count: lead.emailReplyCount || 0,
        updated_at: new Date().toISOString(),
      };

      // Map interest status to is_positive_reply
      if (lead.interestStatus === "interested" || lead.interestStatus === "meeting_booked") {
        leadData.is_positive_reply = true;
      } else if (lead.interestStatus === "not_interested") {
        leadData.is_positive_reply = false;
      }

      // Map status
      if (lead.status) {
        leadData.status = mapLeadStatus(lead.status, lead.interestStatus);
      }

      // For backwards compatibility with Instantly
      if (provider.providerType === "instantly") {
        leadData.instantly_lead_id = lead.id;
      }

      // Store custom fields in metadata
      if (lead.customFields && Object.keys(lead.customFields).length > 0) {
        leadData.metadata = { customFields: lead.customFields };
      }

      if (existing) {
        leadsToUpdate.push({ email: emailLower, data: leadData });
      } else {
        leadData.created_at = lead.createdAt || new Date().toISOString();
        leadsToInsert.push(leadData);
      }
    }

    console.log(
      `[SyncLeads] ${leadsToInsert.length} new leads, ${leadsToUpdate.length} to update`
    );

    // Insert new leads in batches
    let insertedCount = 0;
    const insertBatchSize = 100;

    for (let i = 0; i < leadsToInsert.length; i += insertBatchSize) {
      const batch = leadsToInsert.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase.from("leads").insert(batch);

      if (insertError) {
        console.error(`[SyncLeads] Insert batch error:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    // Update existing leads in batches
    let updatedCount = 0;

    for (const { email, data } of leadsToUpdate) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(data)
        .eq("campaign_id", campaignId)
        .ilike("email", email);

      if (!updateError) {
        updatedCount++;
      }
    }

    // Update last_lead_sync_at
    await supabase
      .from("campaigns")
      .update({ last_lead_sync_at: new Date().toISOString() })
      .eq("id", campaignId);

    console.log(
      `[SyncLeads] Completed: ${insertedCount} inserted, ${updatedCount} updated`
    );

    return NextResponse.json({
      success: true,
      totalFromProvider: providerLeads.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: leadsToInsert.length - insertedCount,
    });
  } catch (error) {
    console.error("[SyncLeads] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync leads",
      },
      { status: 500 }
    );
  }
}

// Map provider status to our internal status
function mapLeadStatus(
  status?: string,
  interestStatus?: ProviderLead["interestStatus"]
): string {
  // Interest status takes priority
  if (interestStatus === "meeting_booked" || interestStatus === "meeting_completed") {
    return "booked";
  }
  if (interestStatus === "interested") {
    return "replied";
  }

  // Fall back to status
  switch (status) {
    case "contacted":
    case "STARTED":
    case "started":
      return "contacted";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "replied":
    case "COMPLETED":
    case "completed":
      return "replied";
    default:
      return "contacted";
  }
}

// GET endpoint to check sync status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("last_lead_sync_at")
    .eq("id", campaignId)
    .single();

  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  return NextResponse.json({
    lastSyncAt: campaign?.last_lead_sync_at,
    leadCount: count || 0,
  });
}
