import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllInstantlyCampaigns,
  fetchAllLeadsForCampaign,
  getInstantlyClient,
} from "@/lib/instantly";
import type { SyncResult } from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Full sync from Instantly to local DB
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client_id, sync_leads = true } = body as {
      client_id: string;
      sync_leads?: boolean;
    };

    if (!client_id) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const supabase = getSupabase();

    // Step 1: Sync campaigns
    const instantlyCampaigns = await fetchAllInstantlyCampaigns();

    const campaignResult: SyncResult = {
      success: true,
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Get existing campaigns for THIS client only
    const { data: existingCampaigns } = await supabase
      .from("campaigns")
      .select("id, instantly_campaign_id")
      .eq("client_id", client_id);

    const existingMap = new Map(
      existingCampaigns?.map(c => [c.instantly_campaign_id, c.id]) || []
    );

    // Also check which Instantly campaign IDs are already used by OTHER clients
    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("instantly_campaign_id")
      .not("instantly_campaign_id", "is", null);

    const allInstantlyIds = new Set(
      allCampaigns?.map(c => c.instantly_campaign_id) || []
    );

    const campaignIdMap = new Map<string, string>(); // instantly_id -> local_id

    for (const campaign of instantlyCampaigns) {
      const existingId = existingMap.get(campaign.id);

      if (existingId) {
        // Update existing campaign (belongs to this client)
        const { error } = await supabase
          .from("campaigns")
          .update({
            name: campaign.name,
            is_active: campaign.status === "active",
          })
          .eq("id", existingId);

        if (error) {
          campaignResult.failed++;
          campaignResult.errors?.push(`Failed to update ${campaign.name}: ${error.message}`);
        } else {
          campaignResult.updated++;
          campaignIdMap.set(campaign.id, existingId);
        }
      } else if (!allInstantlyIds.has(campaign.id)) {
        // Only create if no other client has this campaign
        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            client_id,
            instantly_campaign_id: campaign.id,
            name: campaign.name,
            is_active: campaign.status === "active",
          })
          .select("id")
          .single();

        if (error) {
          campaignResult.failed++;
          campaignResult.errors?.push(`Failed to import ${campaign.name}: ${error.message}`);
        } else {
          campaignResult.imported++;
          campaignIdMap.set(campaign.id, data.id);
        }
      }
      // Skip campaigns that belong to other clients
    }

    // Step 2: Sync leads (if enabled)
    const leadResult: SyncResult = {
      success: true,
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    if (sync_leads) {
      // Get client name for denormalization
      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", client_id)
        .single();
      const clientName = clientData?.name || null;

      for (const [instantlyCampaignId, localCampaignId] of campaignIdMap) {
        try {
          const leads = await fetchAllLeadsForCampaign(instantlyCampaignId);

          // Get campaign name for denormalization
          const { data: campaignData } = await supabase
            .from("campaigns")
            .select("name")
            .eq("id", localCampaignId)
            .single();
          const campaignName = campaignData?.name || null;

          for (const lead of leads) {
            // Check if lead has replied using email_reply_count
            const hasReplied = ((lead as { email_reply_count?: number }).email_reply_count || 0) > 0;

            // Positive reply = manually tagged as interested/booked/etc (NOT just any reply)
            const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed"];
            const isPositiveReply = positiveStatuses.includes(lead.interest_status || "");

            // Map to our lead status: contacted → replied → meeting → closed_won / closed_lost
            let status: string = "contacted";
            if (lead.interest_status === "closed") {
              status = "closed_won";
            } else if (lead.interest_status === "not_interested" || lead.interest_status === "wrong_person") {
              status = "closed_lost";
            } else if (lead.interest_status === "meeting_booked" || lead.interest_status === "meeting_completed") {
              status = "meeting";
            } else if (hasReplied || lead.interest_status === "interested") {
              status = "replied";
            }

            // Extract additional Instantly fields (needed for both insert and update)
            const instantlyData = lead as {
              company_domain?: string;
              personalization?: string;
              timestamp_created?: string;
              timestamp_last_contact?: string;
              status_summary?: { lastStep?: Record<string, unknown> };
              email_open_count?: number;
              email_click_count?: number;
              email_reply_count?: number;
              payload?: Record<string, string>;
            };

            const { data: existingLead } = await supabase
              .from("leads")
              .select("id, status, is_positive_reply, first_name, last_name, company_name, company_domain, phone, personalization, email_open_count, email_click_count, email_reply_count, last_contacted_at")
              .eq("campaign_id", localCampaignId)
              .eq("email", lead.email)
              .single();

            if (existingLead) {
              // Lead exists - UPDATE Instantly-sourced fields while preserving local-only fields
              // Status priority: won(8) > lost(7) > booked(6) > replied(5) > clicked(4) > opened(3) > contacted(2) > not_interested(1)
              const statusPriority: Record<string, number> = {
                "won": 8, "lost": 7, "booked": 6, "replied": 5,
                "clicked": 4, "opened": 3, "contacted": 2, "not_interested": 1
              };

              const currentPriority = statusPriority[existingLead.status] || 0;
              const newPriority = statusPriority[status] || 0;

              // Build update object - only update fields that should be updated
              const updateData: Record<string, unknown> = {
                // Always update these from Instantly (they're Instantly-sourced)
                // Use newer timestamp if available
                last_contacted_at: instantlyData.timestamp_last_contact || null,
                last_step_info: instantlyData.status_summary?.lastStep || null,
                // Only increment counts, never decrease
                email_open_count: Math.max(instantlyData.email_open_count || 0, existingLead.email_open_count || 0),
                email_click_count: Math.max(instantlyData.email_click_count || 0, existingLead.email_click_count || 0),
                email_reply_count: Math.max(instantlyData.email_reply_count || 0, existingLead.email_reply_count || 0),
              };

              // Only update status if new status has higher priority (never downgrade)
              if (newPriority > currentPriority) {
                updateData.status = status;
              }

              // Only set is_positive_reply to true, never reset to false via sync
              // (webhooks can reset it based on explicit negative events)
              if (isPositiveReply && !existingLead.is_positive_reply) {
                updateData.is_positive_reply = true;
              }

              // Fill-only fields: only update if local value is empty
              if (!existingLead.first_name && lead.first_name) {
                updateData.first_name = lead.first_name;
              }
              if (!existingLead.last_name && lead.last_name) {
                updateData.last_name = lead.last_name;
              }
              if (!existingLead.company_name && lead.company_name) {
                updateData.company_name = lead.company_name;
              }
              if (!existingLead.company_domain && instantlyData.company_domain) {
                updateData.company_domain = instantlyData.company_domain;
              }
              if (!existingLead.phone && lead.phone) {
                updateData.phone = lead.phone;
              }
              if (!existingLead.personalization && instantlyData.personalization) {
                updateData.personalization = instantlyData.personalization;
              }

              // NOTE: These fields are NEVER touched by sync (preserved):
              // - notes, deal_value, next_action, next_action_date, linkedin_url

              const { error: updateError } = await supabase
                .from("leads")
                .update(updateData)
                .eq("id", existingLead.id);

              if (updateError) {
                leadResult.failed++;
              } else {
                leadResult.updated++;
              }
            } else {
              // New lead - insert with all Instantly data
              // Build metadata with payload for personalization variables
              const metadata: Record<string, unknown> = {};
              if (instantlyData.payload) {
                metadata.lead_data = instantlyData.payload;
              }

              const { error } = await supabase.from("leads").insert({
                campaign_id: localCampaignId,
                client_id: client_id,
                client_name: clientName,
                campaign_name: campaignName,
                email: lead.email,
                first_name: lead.first_name || null,
                last_name: lead.last_name || null,
                company_name: lead.company_name || null,
                company_domain: instantlyData.company_domain || null,
                phone: lead.phone || null,
                personalization: instantlyData.personalization || null,
                status: status,
                is_positive_reply: isPositiveReply,
                instantly_lead_id: lead.id,
                instantly_created_at: instantlyData.timestamp_created || null,
                last_contacted_at: instantlyData.timestamp_last_contact || null,
                last_step_info: instantlyData.status_summary?.lastStep || null,
                email_reply_count: instantlyData.email_reply_count || 0,
                has_replied: hasReplied,
                metadata: Object.keys(metadata).length > 0 ? metadata : {},
              });

              if (error) {
                leadResult.failed++;
              } else {
                leadResult.imported++;
              }
            }
          }
        } catch (error) {
          leadResult.errors?.push(
            `Failed to sync leads for campaign ${instantlyCampaignId}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaigns: campaignResult,
      leads: sync_leads ? leadResult : null,
    });
  } catch (error) {
    console.error("Error during sync:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
