import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllInstantlyCampaigns,
  fetchAllLeadsForCampaign,
  getCampaignAnalytics,
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

    // Step 2: Sync campaign analytics (always)
    try {
      const analyticsData = await getCampaignAnalytics();
      for (const a of analyticsData) {
        // Find local campaign by Instantly ID
        const localId = campaignIdMap.get(a.campaign_id) || existingMap.get(a.campaign_id);
        if (localId) {
          await supabase
            .from("campaigns")
            .update({
              cached_emails_sent: a.emails_sent_count || 0,
              cached_emails_bounced: a.bounced_count || 0,
              cached_emails_opened: a.open_count_unique || 0,
              cached_reply_count: a.reply_count || 0,
              cache_updated_at: new Date().toISOString(),
            })
            .eq("id", localId);
        }
      }
    } catch (analyticsError) {
      console.error("Failed to sync analytics:", analyticsError);
    }

    // Step 3: Sync leads (if enabled)
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

          // Prepare leads for batch upsert to avoid race conditions
          const leadsToUpsert: Array<Record<string, unknown>> = [];

          for (const lead of leads) {
            // Normalize email for consistent storage and lookup
            const normalizedEmail = lead.email.toLowerCase().trim();

            // Check if lead has replied using email_reply_count
            const hasReplied = ((lead as { email_reply_count?: number }).email_reply_count || 0) > 0;

            // Positive reply = manually tagged as interested/booked/etc (NOT just any reply)
            const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed"];
            const isPositiveReply = positiveStatuses.includes(lead.interest_status || "");

            // Map to our lead status: contacted → replied → booked → won / lost
            let status: string = "contacted";
            if (lead.interest_status === "closed") {
              status = "won";
            } else if (lead.interest_status === "not_interested" || lead.interest_status === "wrong_person") {
              status = "lost";
            } else if (lead.interest_status === "meeting_booked" || lead.interest_status === "meeting_completed") {
              status = "booked";
            } else if (hasReplied || lead.interest_status === "interested") {
              status = "replied";
            }

            // Extract additional Instantly fields
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

            // Build metadata with payload for personalization variables
            const metadata: Record<string, unknown> = {};
            if (instantlyData.payload) {
              metadata.lead_data = instantlyData.payload;
            }

            leadsToUpsert.push({
              campaign_id: localCampaignId,
              client_id: client_id,
              client_name: clientName,
              campaign_name: campaignName,
              email: normalizedEmail,
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
              email_open_count: instantlyData.email_open_count || 0,
              email_click_count: instantlyData.email_click_count || 0,
              email_reply_count: instantlyData.email_reply_count || 0,
              has_replied: hasReplied,
              metadata: Object.keys(metadata).length > 0 ? metadata : {},
              updated_at: new Date().toISOString(),
            });
          }

          // Deduplicate by email (keep last occurrence)
          const deduped = new Map<string, Record<string, unknown>>();
          for (const lead of leadsToUpsert) {
            deduped.set(lead.email as string, lead);
          }
          const uniqueLeads = Array.from(deduped.values());

          // Batch upsert to handle race conditions atomically
          const batchSize = 100;
          for (let i = 0; i < uniqueLeads.length; i += batchSize) {
            const batch = uniqueLeads.slice(i, i + batchSize);
            const { error: upsertError } = await supabase
              .from("leads")
              .upsert(batch, {
                onConflict: "campaign_id,email",
                ignoreDuplicates: false,
              });

            if (upsertError) {
              console.error("[Instantly Sync] Upsert batch error:", upsertError);
              leadResult.failed += batch.length;
            } else {
              leadResult.imported += batch.length;
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
