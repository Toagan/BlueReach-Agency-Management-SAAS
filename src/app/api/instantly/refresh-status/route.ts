import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAllLeadsForCampaign, getInstantlyClient } from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - One-time refresh of lead status from Instantly
// This updates is_positive_reply, status, and email counts for existing leads
// Does NOT delete any leads - preserves all historical data
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { client_id } = body as { client_id?: string };

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const supabase = getSupabase();

    // Get campaigns to refresh (optionally filtered by client)
    let campaignsQuery = supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id, client_id")
      .not("instantly_campaign_id", "is", null);

    if (client_id) {
      campaignsQuery = campaignsQuery.eq("client_id", client_id);
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery;

    if (campaignsError) {
      return NextResponse.json(
        { error: "Failed to fetch campaigns: " + campaignsError.message },
        { status: 500 }
      );
    }

    const results = {
      campaigns_processed: 0,
      leads_updated: 0,
      leads_skipped: 0,
      errors: [] as string[],
    };

    for (const campaign of campaigns || []) {
      if (!campaign.instantly_campaign_id) continue;

      try {
        // Fetch all leads from Instantly for this campaign
        const instantlyLeads = await fetchAllLeadsForCampaign(campaign.instantly_campaign_id);
        results.campaigns_processed++;

        for (const lead of instantlyLeads) {
          // Find the existing lead in our database
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id, status, is_positive_reply")
            .eq("campaign_id", campaign.id)
            .eq("email", lead.email)
            .single();

          if (!existingLead) {
            results.leads_skipped++;
            continue;
          }

          // Extract Instantly data
          const instantlyData = lead as {
            email_reply_count?: number;
            email_open_count?: number;
            email_click_count?: number;
            interest_status?: string;
          };

          // Check if lead has replied
          const hasReplied = (instantlyData.email_reply_count || 0) > 0;

          // Check interest_status for manually tagged leads
          const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed"];
          const hasPositiveInterest = positiveStatuses.includes(lead.interest_status || "");

          // Lead is positive if they replied OR are marked as interested
          const isPositiveReply = hasReplied || hasPositiveInterest;

          // Determine status based on Instantly data
          let newStatus: string | null = null;
          if (lead.interest_status === "meeting_booked") {
            newStatus = "booked";
          } else if (lead.interest_status === "meeting_completed" || lead.interest_status === "closed") {
            newStatus = "won";
          } else if (lead.interest_status === "not_interested" || lead.interest_status === "wrong_person") {
            newStatus = "not_interested";
          } else if (hasReplied || lead.interest_status === "interested") {
            newStatus = "replied";
          }

          // Build update object - only update fields that have new data
          const updateData: Record<string, unknown> = {
            is_positive_reply: isPositiveReply,
            email_open_count: instantlyData.email_open_count || 0,
            email_click_count: instantlyData.email_click_count || 0,
            email_reply_count: instantlyData.email_reply_count || 0,
          };

          // Only update status if we have a more "advanced" status from Instantly
          // Don't downgrade status (e.g., don't change "won" back to "replied")
          const statusPriority: Record<string, number> = {
            contacted: 0,
            opened: 1,
            clicked: 2,
            replied: 3,
            booked: 4,
            won: 5,
            lost: 5,
            not_interested: 3,
          };

          if (newStatus) {
            const currentPriority = statusPriority[existingLead.status] || 0;
            const newPriority = statusPriority[newStatus] || 0;

            // Only update if new status is higher priority or if current is "contacted"
            if (newPriority > currentPriority || existingLead.status === "contacted") {
              updateData.status = newStatus;
            }
          }

          // Update the lead
          const { error: updateError } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", existingLead.id);

          if (updateError) {
            results.errors.push(`Failed to update ${lead.email}: ${updateError.message}`);
          } else {
            results.leads_updated++;
          }
        }
      } catch (error) {
        results.errors.push(
          `Failed to process campaign ${campaign.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error during status refresh:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
