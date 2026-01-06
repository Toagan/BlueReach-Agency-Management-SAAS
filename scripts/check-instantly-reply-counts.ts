/**
 * Check Instantly API for leads with email_reply_count > 0
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get campaign with API key
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, provider_campaign_id, instantly_campaign_id, api_key_encrypted")
    .eq("id", CAMPAIGN_ID)
    .single();

  if (error || !campaign) {
    console.log("Campaign not found:", error);
    return;
  }

  const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;
  console.log("Campaign ID:", campaign.id);
  console.log("Provider Campaign ID:", providerCampaignId);
  console.log("");

  // Scan all leads looking for ones with email_reply_count > 0
  let skip = 0;
  let total = 0;
  let withReplies = 0;
  const repliedLeads: Array<{ email: string; count: number; status: number; ltStatus: number }> = [];

  console.log("Scanning leads from Instantly API...\n");

  while (skip < 5000) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${campaign.api_key_encrypted}`,
      },
      body: JSON.stringify({
        campaign: providerCampaignId,
        limit: 100,
        skip,
      }),
    });

    if (!response.ok) {
      console.log("API Error:", response.status);
      const text = await response.text();
      console.log(text.substring(0, 200));
      break;
    }

    const data = await response.json();
    const leads = data.items || [];

    if (leads.length === 0) break;

    total += leads.length;

    for (const lead of leads) {
      if (lead.email_reply_count > 0) {
        withReplies++;
        repliedLeads.push({
          email: lead.email,
          count: lead.email_reply_count,
          status: lead.status,
          ltStatus: lead.lt_interest_status,
        });
      }
    }

    skip += 100;

    if (skip % 500 === 0) {
      console.log(`Scanned ${skip} leads, found ${withReplies} with replies...`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Total leads scanned: ${total}`);
  console.log(`Leads with email_reply_count > 0: ${withReplies}`);
  console.log("");

  if (repliedLeads.length > 0) {
    console.log("Sample of replied leads (first 20):");
    for (const lead of repliedLeads.slice(0, 20)) {
      console.log(`  ${lead.email}`);
      console.log(`    email_reply_count: ${lead.count}`);
      console.log(`    status: ${lead.status}`);
      console.log(`    lt_interest_status: ${lead.ltStatus}`);
      console.log("");
    }
  }
}

main().catch(console.error);
