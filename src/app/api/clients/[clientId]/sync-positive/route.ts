import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Sync only positive leads from Instantly (much faster than full sync)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const supabase = getSupabase();

    // Get all campaigns for this client
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id, provider_campaign_id, provider_type, api_key_encrypted")
      .eq("client_id", clientId);

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      return NextResponse.json(
        { error: "Failed to fetch campaigns" },
        { status: 500 }
      );
    }

    let totalSynced = 0;
    let totalCreated = 0;
    let campaignsProcessed = 0;
    let campaignsWithoutApiKey = 0;
    const errors: string[] = [];

    // IMPORTANT: First reset ALL is_positive_reply=false for this client
    // This ensures we start with a clean slate before marking only truly positive leads
    console.log(`[Sync Positive] Resetting is_positive_reply for all leads of client ${clientId}...`);
    const { error: resetAllError } = await supabase
      .from("leads")
      .update({ is_positive_reply: false })
      .eq("client_id", clientId)
      .eq("is_positive_reply", true);

    if (resetAllError) {
      console.error(`[Sync Positive] Error resetting leads:`, resetAllError);
    } else {
      console.log(`[Sync Positive] Reset all leads to is_positive_reply=false`);
    }

    // For each campaign, fetch positive leads using the per-campaign API key
    for (const campaign of campaigns || []) {
      const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;
      if (!providerCampaignId) {
        console.log(`[Sync Positive] Skipping campaign ${campaign.name} - no provider campaign ID`);
        continue;
      }

      if (!campaign.api_key_encrypted) {
        console.log(`[Sync Positive] Skipping campaign ${campaign.name} - no API key configured`);
        campaignsWithoutApiKey++;
        continue;
      }

      console.log(`[Sync Positive] Fetching positive leads for campaign: ${campaign.name}`);
      campaignsProcessed++;

      try {
        // Get provider with per-campaign API key
        const provider = await getProviderForCampaign(campaign.id);

        // Fetch only positive leads (uses interest_status filter)
        let positiveLeads: { email: string; firstName?: string; lastName?: string; companyName?: string; interestStatus?: string }[] = [];

        if ('fetchPositiveLeads' in provider && typeof provider.fetchPositiveLeads === 'function') {
          console.log(`[Sync Positive] Using fetchPositiveLeads for ${campaign.name}`);
          positiveLeads = await (provider as { fetchPositiveLeads: (id: string) => Promise<{ email: string; firstName?: string; lastName?: string; companyName?: string; interestStatus?: string }[]> }).fetchPositiveLeads(providerCampaignId);
        } else {
          // Fallback for providers without fetchPositiveLeads - THIS SHOULD NOT HAPPEN FOR INSTANTLY
          console.warn(`[Sync Positive] WARNING: Using fallback (fetchAllLeads) for ${campaign.name} - provider type: ${provider.providerType}`);
          const allLeads = await provider.fetchAllLeads(providerCampaignId);
          positiveLeads = allLeads.filter(
            (lead) => lead.interestStatus === "interested" ||
                      lead.interestStatus === "meeting_booked" ||
                      lead.interestStatus === "meeting_completed" ||
                      lead.interestStatus === "closed"
          );
          console.log(`[Sync Positive] Fallback filtered ${allLeads.length} leads down to ${positiveLeads.length} positive`);
        }

        console.log(`[Sync Positive] Found ${positiveLeads.length} positive leads in provider for ${campaign.name}`);

        // Get client name once for all leads
        const { data: clientData } = await supabase
          .from("clients")
          .select("name")
          .eq("id", clientId)
          .single();
        const clientName = clientData?.name || "";

        for (const lead of positiveLeads) {
          // Normalize email to handle case sensitivity and whitespace
          const normalizedEmail = lead.email.toLowerCase().trim();

          // Map interest status to our status field
          const leadStatus = mapInterestStatusToStatus(lead.interestStatus);

          // First, try to find and update existing lead (case-insensitive email match)
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("campaign_id", campaign.id)
            .ilike("email", normalizedEmail)
            .single();

          if (existingLead) {
            // Update existing lead to mark as positive
            const { error: updateError } = await supabase
              .from("leads")
              .update({
                is_positive_reply: true,
                has_replied: true,
                status: leadStatus,
                client_id: clientId,
                client_name: clientName,
              })
              .eq("id", existingLead.id);

            if (updateError) {
              console.error(`[Sync Positive] Error updating lead ${normalizedEmail}:`, updateError);
            } else {
              totalCreated++;
            }
          } else {
            // Create new lead if it doesn't exist
            const { error: insertError } = await supabase
              .from("leads")
              .insert({
                email: normalizedEmail,
                first_name: lead.firstName || null,
                last_name: lead.lastName || null,
                company_name: lead.companyName || null,
                campaign_id: campaign.id,
                client_id: clientId,
                client_name: clientName,
                campaign_name: campaign.name,
                is_positive_reply: true,
                has_replied: true,
                status: leadStatus,
              });

            if (insertError) {
              console.error(`[Sync Positive] Error inserting lead ${normalizedEmail}:`, insertError);
            } else {
              totalCreated++;
            }
          }

          totalSynced++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Sync Positive] Error syncing campaign ${campaign.name}:`, err);
        errors.push(`${campaign.name}: ${errorMsg}`);
      }
    }

    console.log(`[Sync Positive] Complete - ${totalSynced} synced, ${totalCreated} updated, ${campaignsProcessed} campaigns processed`);

    // Build informative message
    let message = "";
    if (campaignsProcessed === 0) {
      if (campaignsWithoutApiKey > 0) {
        message = `No campaigns have API keys configured. Please add API keys in campaign settings.`;
      } else if ((campaigns || []).length === 0) {
        message = "No campaigns found for this client";
      } else {
        message = "No campaigns could be processed";
      }
    } else if (totalSynced === 0) {
      message = `Checked ${campaignsProcessed} campaign(s) - no positive leads found in Instantly`;
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      upserted: totalCreated,
      campaignsProcessed,
      campaignsWithoutApiKey,
      totalCampaigns: (campaigns || []).length,
      message,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in sync positive leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync positive leads" },
      { status: 500 }
    );
  }
}

// Map interest status to our internal status
function mapInterestStatusToStatus(interestStatus?: string): string {
  switch (interestStatus) {
    case "meeting_booked":
    case "meeting_completed":
      return "booked";
    case "closed":
      return "won";
    case "interested":
    default:
      return "replied";
  }
}
