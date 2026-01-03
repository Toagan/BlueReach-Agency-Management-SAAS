import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchInstantlyLeads } from "@/lib/instantly";

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
      .select("id, name, instantly_campaign_id")
      .eq("client_id", clientId)
      .not("instantly_campaign_id", "is", null);

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      return NextResponse.json(
        { error: "Failed to fetch campaigns" },
        { status: 500 }
      );
    }

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    // For each campaign, fetch positive leads from Instantly
    for (const campaign of campaigns || []) {
      if (!campaign.instantly_campaign_id) continue;

      console.log(`[Sync Positive] Fetching positive leads for campaign: ${campaign.name}`);

      // Fetch positive leads from Instantly (interest_status: 1 = positive)
      // Need to paginate since API limit is 100
      const positiveLeads = [];
      let skip = 0;
      while (true) {
        const batch = await fetchInstantlyLeads({
          campaign_id: campaign.instantly_campaign_id,
          interest_status: 1,
          limit: 100,
          skip,
        });
        positiveLeads.push(...batch);
        if (batch.length < 100) break;
        skip += 100;
      }

      console.log(`[Sync Positive] Found ${positiveLeads.length} positive leads in Instantly for ${campaign.name}`);

      for (const lead of positiveLeads) {
        // Check if lead exists in local database
        const { data: existingLead, error: findError } = await supabase
          .from("leads")
          .select("id, is_positive_reply")
          .eq("email", lead.email)
          .eq("campaign_id", campaign.id)
          .single();

        if (findError && findError.code !== "PGRST116") {
          console.error("Error finding lead:", findError);
          continue;
        }

        if (existingLead) {
          // Lead exists - update if not already marked as positive
          if (!existingLead.is_positive_reply) {
            const { error: updateError } = await supabase
              .from("leads")
              .update({
                is_positive_reply: true,
                lt_interest_status: 1,
                has_replied: true,
                status: "replied",
              })
              .eq("id", existingLead.id);

            if (updateError) {
              console.error("Error updating lead:", updateError);
            } else {
              totalUpdated++;
              console.log(`[Sync Positive] Updated lead: ${lead.email}`);
            }
          }
        } else {
          // Lead doesn't exist - create it
          const { error: createError } = await supabase
            .from("leads")
            .insert({
              email: lead.email,
              first_name: lead.first_name || null,
              last_name: lead.last_name || null,
              company_name: lead.company_name || null,
              campaign_id: campaign.id,
              client_id: clientId,
              client_name: (await supabase.from("clients").select("name").eq("id", clientId).single()).data?.name || "",
              campaign_name: campaign.name,
              is_positive_reply: true,
              has_replied: true,
              lt_interest_status: 1,
              status: "replied",
            });

          if (createError) {
            console.error("Error creating lead:", createError);
          } else {
            totalCreated++;
            console.log(`[Sync Positive] Created lead: ${lead.email}`);
          }
        }

        totalSynced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      created: totalCreated,
      updated: totalUpdated,
    });
  } catch (error) {
    console.error("Error in sync positive leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync positive leads" },
      { status: 500 }
    );
  }
}
