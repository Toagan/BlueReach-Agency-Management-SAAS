// Test interest_status with string values like 'positive'
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const PROVIDER_CAMPAIGN_ID = "01c2efd7-8db4-4d39-8dab-e85a40a77e1c";

async function countLeads(apiKey: string, params: Record<string, unknown>): Promise<number> {
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
      body: JSON.stringify({
        ...params,
        limit,
        skip,
      }),
    });

    if (!response.ok) {
      console.log(`  Error: ${response.status}`);
      return -1;
    }

    const data = await response.json();
    const leads = data.items || [];
    total += leads.length;

    if (leads.length < limit) break;
    skip += limit;

    // Safety cap
    if (skip > 500) {
      console.log(`  (stopped at ${total}+)`);
      return total;
    }
  }

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

  console.log("Testing interest_status filter with different values...\n");

  // Test A: String 'positive'
  console.log("=== Request A: interest_status='positive' ===");
  const countPositive = await countLeads(apiKey, {
    campaign: PROVIDER_CAMPAIGN_ID,
    interest_status: "positive",
  });
  console.log(`Result: ${countPositive} leads\n`);

  // Test B: No filter
  console.log("=== Request B: No interest_status filter ===");
  const countNoFilter = await countLeads(apiKey, {
    campaign: PROVIDER_CAMPAIGN_ID,
  });
  console.log(`Result: ${countNoFilter} leads\n`);

  // Additional tests with other string values
  console.log("=== Additional Tests ===\n");

  const testValues = [
    "interested",
    "Positive",
    "POSITIVE",
    "meeting_booked",
    "opportunity",
  ];

  for (const value of testValues) {
    process.stdout.write(`interest_status='${value}': `);
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        campaign: PROVIDER_CAMPAIGN_ID,
        interest_status: value,
        limit: 100,
      }),
    });

    const data = await response.json();
    const count = data.items?.length || 0;
    console.log(`${count} leads (first page)`);
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`With 'positive' filter: ${countPositive}`);
  console.log(`Without filter: ${countNoFilter}`);
  console.log(`Expected from analytics: 55`);

  if (countPositive !== countNoFilter && countPositive > 0 && countPositive < 100) {
    console.log("\n✅ The 'positive' string filter appears to work!");
  } else if (countPositive === countNoFilter) {
    console.log("\n❌ Filter still being ignored (same count with and without)");
  }
}

main().catch(console.error);
