// Test with the CORRECT field: lt_interest_status
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const PROVIDER_CAMPAIGN_ID = "01c2efd7-8db4-4d39-8dab-e85a40a77e1c";

async function countLeads(apiKey: string, params: Record<string, unknown>, label: string): Promise<number> {
  let total = 0;
  let skip = 0;
  const limit = 100;

  while (true) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...params, limit, skip }),
    });

    const data = await response.json();
    const leads = data.items || [];
    total += leads.length;

    if (leads.length < limit) break;
    skip += limit;

    if (skip > 200) {
      console.log(`  ${label}: ${total}+ (stopped at 200)`);
      return total;
    }
  }

  console.log(`  ${label}: ${total}`);
  return total;
}

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

  console.log("=== Testing lt_interest_status filter ===\n");

  // Test different lt_interest_status values
  const tests = [
    { label: "lt_interest_status: 1 (Interested)", params: { campaign: PROVIDER_CAMPAIGN_ID, lt_interest_status: 1 } },
    { label: "lt_interest_status: 2 (Not Interested)", params: { campaign: PROVIDER_CAMPAIGN_ID, lt_interest_status: 2 } },
    { label: "lt_interest_status: 3 (Meeting Booked?)", params: { campaign: PROVIDER_CAMPAIGN_ID, lt_interest_status: 3 } },
    { label: "lt_interest_status: 0", params: { campaign: PROVIDER_CAMPAIGN_ID, lt_interest_status: 0 } },
    { label: "No filter (baseline)", params: { campaign: PROVIDER_CAMPAIGN_ID } },
  ];

  const results: Record<string, number> = {};

  for (const test of tests) {
    results[test.label] = await countLeads(apiKey, test.params, test.label);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Expected from analytics: 55 opportunities`);
  console.log(`\nResults:`);
  for (const [label, count] of Object.entries(results)) {
    const marker = count === 55 || (count > 50 && count < 60) ? " ✅ POSSIBLE MATCH!" : "";
    console.log(`  ${label}: ${count}${marker}`);
  }

  // If lt_interest_status=1 looks promising, show sample leads
  if (results["lt_interest_status: 1 (Interested)"] > 0 && results["lt_interest_status: 1 (Interested)"] < 100) {
    console.log("\n=== SAMPLE LEADS WITH lt_interest_status=1 ===");

    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        campaign: PROVIDER_CAMPAIGN_ID,
        lt_interest_status: 1,
        limit: 10,
      }),
    });

    const data = await response.json();
    (data.items || []).forEach((lead: any) => {
      console.log(`  ${lead.email} (lt_interest_status: ${lead.lt_interest_status}, replies: ${lead.email_reply_count})`);
    });
  }
}

main().catch(console.error);
