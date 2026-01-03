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

        // Use upsert to handle duplicates gracefully
        const { data: upsertedLead, error: upsertError } = await supabase
          .from("leads")
          .upsert(
            {
              email: normalizedEmail,
              first_name: lead.first_name || null,
              last_name: lead.last_name || null,
              company_name: lead.company_name || null,
              campaign_id: campaign.id,
              client_id: clientId,
              client_name: clientName,
              campaign_name: campaign.name,
              is_positive_reply: true,
              has_replied: true,
              lt_interest_status: 1,
              status: "replied",
            },
            {
              onConflict: "campaign_id,email",
              ignoreDuplicates: false, // Update existing records
            }
          )
          .select("id")
          .single();

        if (upsertError) {
          console.error(`[Sync Positive] Error upserting lead ${normalizedEmail}:`, upsertError);
        } else {
          totalCreated++;
          console.log(`[Sync Positive] Upserted lead: ${normalizedEmail}`);
        }

        totalSynced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      upserted: totalCreated,
    });
  } catch (error) {
    console.error("Error in sync positive leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync positive leads" },
      { status: 500 }
    );
  }
}
