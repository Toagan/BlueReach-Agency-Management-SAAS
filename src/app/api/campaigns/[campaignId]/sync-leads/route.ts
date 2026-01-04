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
      .select("email, provider_lead_id, instantly_lead_id, client_id")
      .eq("campaign_id", campaignId);

    // Fix any leads with missing client_id
    const leadsWithoutClientId = (existingLeads || []).filter(l => !l.client_id);
    if (leadsWithoutClientId.length > 0 && campaign.client_id) {
      console.log(`[SyncLeads] Fixing ${leadsWithoutClientId.length} leads with missing client_id`);
      await supabase
        .from("leads")
        .update({
          client_id: campaign.client_id,
          client_name: client?.name,
          campaign_name: campaign.name
        })
        .eq("campaign_id", campaignId)
        .is("client_id", null);
    }

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
        // website field removed - not in leads table schema
        provider_type: provider.providerType,
        provider_lead_id: lead.id,
        email_open_count: lead.emailOpenCount || 0,
        email_click_count: lead.emailClickCount || 0,
        email_reply_count: lead.emailReplyCount || 0,
        updated_at: new Date().toISOString(),
      };

      // NOTE: We do NOT set is_positive_reply here because the Instantly /leads/list endpoint
      // does NOT return interest_status for regular leads. We fetch positive leads separately
      // at the end of this sync using fetchPositiveLeads() which filters by interest_status.
      // Setting is_positive_reply based on non-existent data caused 11k+ false positives.

      // We only set is_positive_reply = false for explicitly negative statuses
      const interestStatus = lead.interestStatus;
      const negativeStatuses = ["not_interested", 2, "2"];

      if (negativeStatuses.includes(interestStatus as string | number)) {
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
    const totalBatches = Math.ceil(leadsToInsert.length / insertBatchSize);

    console.log(`[SyncLeads] Inserting ${leadsToInsert.length} leads in ${totalBatches} batches...`);

    for (let i = 0; i < leadsToInsert.length; i += insertBatchSize) {
      const batch = leadsToInsert.slice(i, i + insertBatchSize);
      const batchNum = Math.floor(i / insertBatchSize) + 1;

      const { error: insertError } = await supabase.from("leads").insert(batch);

      if (insertError) {
        console.error(`[SyncLeads] Insert batch ${batchNum}/${totalBatches} error:`, insertError);
      } else {
        insertedCount += batch.length;
      }

      // Log progress every 50 batches
      if (batchNum % 50 === 0) {
        console.log(`[SyncLeads] Inserted ${insertedCount}/${leadsToInsert.length} leads...`);
      }
    }

    console.log(`[SyncLeads] Finished inserting ${insertedCount} leads`);

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

    // Also sync campaign analytics from the provider
    let analyticsData = null;
    try {
      const analytics = await provider.fetchCampaignAnalytics(providerCampaignId);
      if (analytics) {
        analyticsData = {
          emails_sent: analytics.emailsSentCount || 0,
          emails_opened: analytics.openCountUnique || 0,
          emails_replied: analytics.replyCount || 0,
          emails_bounced: analytics.bouncedCount || 0,
          total_opportunities: analytics.totalOpportunities || 0,
          leads_count: analytics.leadsCount || 0,
          contacted_count: analytics.contactedCount || 0,
        };

        await supabase
          .from("campaigns")
          .update({
            cached_emails_sent: analytics.emailsSentCount || 0,
            cached_emails_opened: analytics.openCountUnique || 0,
            cached_reply_count: analytics.replyCount || 0,
            cached_emails_bounced: analytics.bouncedCount || 0,
            cached_positive_count: analytics.totalOpportunities || 0,
            cache_updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);

        console.log(`[SyncLeads] Synced analytics: ${analytics.emailsSentCount} sent, ${analytics.replyCount} replies`);
      }
    } catch (analyticsError) {
      console.warn(`[SyncLeads] Could not sync analytics:`, analyticsError);
    }

    // Sync positive leads specifically (Instantly doesn't return interest_status in regular leads list)
    // IMPORTANT: First reset all is_positive_reply to false, then mark only the truly positive ones
    let positiveLeadsSynced = 0;
    try {
      // Check if provider has fetchPositiveLeads method (Instantly-specific)
      if ('fetchPositiveLeads' in provider && typeof provider.fetchPositiveLeads === 'function') {
        console.log(`[SyncLeads] Resetting is_positive_reply for all leads in this campaign...`);

        // Reset all leads in this campaign to not positive (clean slate)
        const { error: resetError } = await supabase
          .from("leads")
          .update({ is_positive_reply: false })
          .eq("campaign_id", campaignId)
          .eq("is_positive_reply", true);

        if (resetError) {
          console.warn(`[SyncLeads] Error resetting positive leads:`, resetError);
        }

        console.log(`[SyncLeads] Fetching positive leads from provider...`);
        const positiveLeads = await (provider as { fetchPositiveLeads: (id: string) => Promise<ProviderLead[]> }).fetchPositiveLeads(providerCampaignId);

        console.log(`[SyncLeads] Found ${positiveLeads.length} positive leads to sync`);

        for (const lead of positiveLeads) {
          const emailLower = lead.email.toLowerCase();

          // Update existing lead to mark as positive
          const { error: updateError } = await supabase
            .from("leads")
            .update({
              is_positive_reply: true,
              has_replied: true,
              status: "replied",
            })
            .eq("campaign_id", campaignId)
            .ilike("email", emailLower);

          if (!updateError) {
            positiveLeadsSynced++;
          }
        }

        console.log(`[SyncLeads] Marked ${positiveLeadsSynced} leads as positive`);
      }
    } catch (positiveError) {
      console.warn(`[SyncLeads] Could not sync positive leads:`, positiveError);
    }

    console.log(
      `[SyncLeads] Completed: ${insertedCount} inserted, ${updatedCount} updated`
    );

    return NextResponse.json({
      success: true,
      totalFromProvider: providerLeads.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: leadsToInsert.length - insertedCount,
      analytics: analyticsData,
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
  // Interest status takes priority (handle both string and numeric)
  const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed", 1, 3, "1", "3"];
  const bookedStatuses = ["meeting_booked", "meeting_completed", 3, "3"];

  if (bookedStatuses.includes(interestStatus as string | number)) {
    return "booked";
  }
  if (positiveStatuses.includes(interestStatus as string | number)) {
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
