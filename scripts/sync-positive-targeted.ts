// Targeted Sync Positive - Skip global reset, match by instantly_lead_id
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const POSITIVE_STATUSES = [1, 3, 4, 5]; // interested, meeting_booked, meeting_completed, closed

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get campaign details
  console.log(`[Targeted Sync] Fetching campaign ${CAMPAIGN_ID}...`);
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, name, provider_campaign_id, instantly_campaign_id, api_key_encrypted")
    .eq("id", CAMPAIGN_ID)
    .single();

  if (campaignError || !campaign) {
    console.error("Campaign not found:", campaignError);
    process.exit(1);
  }

  console.log(`[Targeted Sync] Campaign: ${campaign.name}`);

  const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;
  if (!providerCampaignId) {
    console.error("No provider campaign ID");
    process.exit(1);
  }

  if (!campaign.api_key_encrypted) {
    console.error("No API key configured");
    process.exit(1);
  }

  // The api_key_encrypted field contains the actual API key
  const apiKey = campaign.api_key_encrypted;

  console.log(`[Targeted Sync] Provider Campaign ID: ${providerCampaignId}`);
  console.log(`[Targeted Sync] Fetching positive leads from Instantly...`);

  // Fetch positive leads from Instantly API
  const allPositiveLeads: Array<{ id: string; email: string; interest_status: number }> = [];

  for (const status of POSITIVE_STATUSES) {
    let skip = 0;
    const limit = 100;

    console.log(`[Targeted Sync] Fetching leads with interest_status=${status}...`);

    while (true) {
      const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          campaign: providerCampaignId,
          interest_status: status,
          limit,
          skip,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (status ${status}):`, response.status, errorText);
        break;
      }

      const data = await response.json();
      const leads = data.items || [];

      console.log(`[Targeted Sync] Got ${leads.length} leads with interest_status=${status} (skip=${skip})`);

      for (const lead of leads) {
        allPositiveLeads.push({
          id: lead.id,
          email: lead.email,
          interest_status: status,
        });
      }

      if (leads.length < limit) {
        break;
      }
      skip += limit;
    }
  }

  console.log(`\n[Targeted Sync] Total positive leads from Instantly: ${allPositiveLeads.length}`);

  if (allPositiveLeads.length === 0) {
    console.log("[Targeted Sync] No positive leads found. Check API response.");
    process.exit(0);
  }

  // Show sample of leads
  console.log("\n[Targeted Sync] Sample leads:");
  allPositiveLeads.slice(0, 5).forEach(l => {
    console.log(`  - ${l.email} (ID: ${l.id}, status: ${l.interest_status})`);
  });

  // Update leads by instantly_lead_id (NO GLOBAL RESET)
  console.log(`\n[Targeted Sync] Updating leads by instantly_lead_id...`);

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFoundEmails: string[] = [];

  for (const lead of allPositiveLeads) {
    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update({
        is_positive_reply: true,
        has_replied: true,
      })
      .eq("campaign_id", CAMPAIGN_ID)
      .eq("instantly_lead_id", lead.id)
      .select("id, email");

    if (updateError) {
      console.error(`Error updating ${lead.email}:`, updateError);
    } else if (updated && updated.length > 0) {
      updatedCount++;
    } else {
      notFoundCount++;
      notFoundEmails.push(lead.email);
    }
  }

  console.log(`\n[Targeted Sync] Results:`);
  console.log(`  - Updated: ${updatedCount}`);
  console.log(`  - Not found by ID: ${notFoundCount}`);

  if (notFoundEmails.length > 0 && notFoundEmails.length <= 10) {
    console.log(`  - Not found emails:`);
    notFoundEmails.forEach(e => console.log(`    - ${e}`));
  } else if (notFoundEmails.length > 10) {
    console.log(`  - First 10 not found emails:`);
    notFoundEmails.slice(0, 10).forEach(e => console.log(`    - ${e}`));
  }

  // Count final positive leads
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("is_positive_reply", true);

  console.log(`\n[Targeted Sync] Final count of is_positive_reply=true: ${count}`);
}

main().catch(console.error);
