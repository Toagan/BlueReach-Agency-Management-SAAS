// Find a lead with replies and inspect its full schema
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

  console.log("=== Searching for leads with email_reply_count > 0 ===\n");

  let skip = 0;
  const limit = 100;
  let foundLeads: any[] = [];

  while (foundLeads.length < 5 && skip < 5000) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        campaign: PROVIDER_CAMPAIGN_ID,
        limit,
        skip,
      }),
    });

    const data = await response.json();
    const leads = data.items || [];

    for (const lead of leads) {
      if (lead.email_reply_count > 0) {
        foundLeads.push(lead);
        console.log(`Found: ${lead.email} (${lead.email_reply_count} replies)`);
      }
    }

    if (leads.length < limit) break;
    skip += limit;

    if (skip % 500 === 0) {
      console.log(`  Searched ${skip} leads, found ${foundLeads.length} with replies...`);
    }
  }

  console.log(`\nTotal found: ${foundLeads.length} leads with replies\n`);

  if (foundLeads.length > 0) {
    console.log("=".repeat(70));
    console.log("FULL JSON - LEAD WITH REPLY");
    console.log("=".repeat(70));
    console.log(JSON.stringify(foundLeads[0], null, 2));

    // List ALL fields
    console.log("\n--- ALL FIELD NAMES ---");
    Object.keys(foundLeads[0]).sort().forEach(key => {
      const value = foundLeads[0][key];
      const valueStr = JSON.stringify(value);
      console.log(`  ${key}: ${valueStr.substring(0, 80)}${valueStr.length > 80 ? '...' : ''}`);
    });

    // Get detailed view via single lead endpoint
    console.log("\n" + "=".repeat(70));
    console.log("DETAILED VIEW - GET /leads/{id}");
    console.log("=".repeat(70));

    const detailResponse = await fetch(`https://api.instantly.ai/api/v2/leads/${foundLeads[0].id}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    if (detailResponse.ok) {
      const detail = await detailResponse.json();
      console.log(JSON.stringify(detail, null, 2));

      // Compare fields
      const listKeys = new Set(Object.keys(foundLeads[0]));
      const detailKeys = new Set(Object.keys(detail));
      const newInDetail = [...detailKeys].filter(k => !listKeys.has(k));

      if (newInDetail.length > 0) {
        console.log("\n--- NEW FIELDS IN DETAIL ENDPOINT ---");
        newInDetail.forEach(k => console.log(`  + ${k}: ${JSON.stringify(detail[k])}`));
      } else {
        console.log("\n(No additional fields in detail endpoint)");
      }
    }

    // Compare with a lead WITHOUT replies
    console.log("\n" + "=".repeat(70));
    console.log("COMPARING FIELDS: WITH REPLY vs WITHOUT REPLY");
    console.log("=".repeat(70));

    // Fetch a lead without replies
    const noReplyResponse = await fetch("https://api.instantly.ai/api/v2/leads/list", {
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

    const noReplyData = await noReplyResponse.json();
    const noReplyLead = noReplyData.items?.find((l: any) => l.email_reply_count === 0);

    if (noReplyLead) {
      const withReply = foundLeads[0];
      const allKeys = new Set([...Object.keys(withReply), ...Object.keys(noReplyLead)]);

      console.log("\nField comparison:");
      for (const key of [...allKeys].sort()) {
        const val1 = withReply[key];
        const val2 = noReplyLead[key];
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          console.log(`\n  ${key}:`);
          console.log(`    WITH REPLY:    ${JSON.stringify(val1)?.substring(0, 60)}`);
          console.log(`    WITHOUT REPLY: ${JSON.stringify(val2)?.substring(0, 60)}`);
        }
      }
    }
  }
}

main().catch(console.error);
