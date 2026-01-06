// Inspect full lead schema from Instantly API
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const PROVIDER_CAMPAIGN_ID = "01c2efd7-8db4-4d39-8dab-e85a40a77e1c";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("api_key_encrypted")
    .eq("id", CAMPAIGN_ID)
    .single();

  const apiKey = campaign?.api_key_encrypted!;

  // Fetch a batch of leads
  console.log("=== Fetching leads to inspect full schema ===\n");

  const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign: PROVIDER_CAMPAIGN_ID,
      limit: 50,
    }),
  });

  const data = await response.json();
  const leads = data.items || [];

  console.log(`Fetched ${leads.length} leads\n`);

  // Find leads with different characteristics
  const leadsWithReplies = leads.filter((l: any) => l.email_reply_count > 0);
  const leadsWithoutReplies = leads.filter((l: any) => l.email_reply_count === 0);

  console.log(`Leads with replies: ${leadsWithReplies.length}`);
  console.log(`Leads without replies: ${leadsWithoutReplies.length}\n`);

  // Show ALL fields from a lead with replies
  if (leadsWithReplies.length > 0) {
    console.log("=".repeat(70));
    console.log("FULL JSON - LEAD WITH REPLY (email_reply_count > 0)");
    console.log("=".repeat(70));
    console.log(JSON.stringify(leadsWithReplies[0], null, 2));

    // List all keys
    console.log("\n--- ALL FIELD NAMES ---");
    const allKeys = Object.keys(leadsWithReplies[0]);
    allKeys.forEach(key => {
      const value = leadsWithReplies[0][key];
      const valueType = typeof value;
      const valuePreview = valueType === "object" ? JSON.stringify(value).substring(0, 50) : String(value).substring(0, 50);
      console.log(`  ${key}: (${valueType}) ${valuePreview}`);
    });
  }

  // Show a lead without replies for comparison
  if (leadsWithoutReplies.length > 0) {
    console.log("\n" + "=".repeat(70));
    console.log("FULL JSON - LEAD WITHOUT REPLY (for comparison)");
    console.log("=".repeat(70));
    console.log(JSON.stringify(leadsWithoutReplies[0], null, 2));
  }

  // Also try to fetch a single lead by ID for more detail
  if (leadsWithReplies.length > 0) {
    const leadId = leadsWithReplies[0].id;
    console.log("\n" + "=".repeat(70));
    console.log(`SINGLE LEAD DETAIL - GET /leads/${leadId}`);
    console.log("=".repeat(70));

    const detailResponse = await fetch(`https://api.instantly.ai/api/v2/leads/${leadId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (detailResponse.ok) {
      const detailData = await detailResponse.json();
      console.log(JSON.stringify(detailData, null, 2));

      // Check if detail has more fields than list
      const detailKeys = Object.keys(detailData);
      const listKeys = Object.keys(leadsWithReplies[0]);
      const newKeys = detailKeys.filter(k => !listKeys.includes(k));

      if (newKeys.length > 0) {
        console.log("\n--- ADDITIONAL FIELDS IN DETAIL ENDPOINT ---");
        newKeys.forEach(key => console.log(`  + ${key}`));
      }
    } else {
      console.log(`Error: ${detailResponse.status}`);
    }
  }

  // Look for any field that might indicate interest status
  console.log("\n" + "=".repeat(70));
  console.log("SEARCHING FOR INTEREST/STATUS RELATED FIELDS");
  console.log("=".repeat(70));

  const interestKeywords = ["interest", "status", "label", "tag", "positive", "opportunity", "stage", "category", "type"];

  for (const lead of leads.slice(0, 10)) {
    const keys = Object.keys(lead);
    const matchingKeys = keys.filter(k =>
      interestKeywords.some(kw => k.toLowerCase().includes(kw))
    );

    if (matchingKeys.length > 0) {
      console.log(`\nLead ${lead.email}:`);
      matchingKeys.forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(lead[key])}`);
      });
    }
  }

  // Check if there's a 'lead_status' or similar in payload
  console.log("\n" + "=".repeat(70));
  console.log("CHECKING PAYLOAD/CUSTOM FIELDS FOR STATUS INFO");
  console.log("=".repeat(70));

  for (const lead of leads.slice(0, 5)) {
    if (lead.payload && Object.keys(lead.payload).length > 0) {
      console.log(`\nLead ${lead.email} payload:`);
      console.log(JSON.stringify(lead.payload, null, 2));
    }
  }
}

main().catch(console.error);
