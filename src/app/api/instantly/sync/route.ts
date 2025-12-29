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

    // Get existing campaigns
    const { data: existingCampaigns } = await supabase
      .from("campaigns")
      .select("id, instantly_campaign_id")
      .eq("client_id", client_id);

    const existingMap = new Map(
      existingCampaigns?.map(c => [c.instantly_campaign_id, c.id]) || []
    );

    const campaignIdMap = new Map<string, string>(); // instantly_id -> local_id

    for (const campaign of instantlyCampaigns) {
      const existingId = existingMap.get(campaign.id);

      if (existingId) {
        // Update existing campaign
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
      } else {
        // Create new campaign
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
      for (const [instantlyCampaignId, localCampaignId] of campaignIdMap) {
        try {
          const leads = await fetchAllLeadsForCampaign(instantlyCampaignId);

          for (const lead of leads) {
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id")
              .eq("campaign_id", localCampaignId)
              .eq("email", lead.email)
              .single();

            if (existingLead) {
              const { error } = await supabase
                .from("leads")
                .update({
                  first_name: lead.first_name || undefined,
                  instantly_lead_id: lead.id,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingLead.id);

              if (error) {
                leadResult.failed++;
              } else {
                leadResult.updated++;
              }
            } else {
              const { error } = await supabase.from("leads").insert({
                campaign_id: localCampaignId,
                email: lead.email,
                first_name: lead.first_name || null,
                status: "contacted",
                instantly_lead_id: lead.id,
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
