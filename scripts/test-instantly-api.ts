// Test Instantly API - check if campaign filter works with interest_status
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

  // Get API key
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("api_key_encrypted")
    .eq("id", CAMPAIGN_ID)
    .single();

  const apiKey = campaign?.api_key_encrypted;
  if (!apiKey) {
    console.error("No API key");
    process.exit(1);
  }

  console.log("=== TEST 1: Fetch with campaign + interest_status=1 ===");
  const response1 = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign: PROVIDER_CAMPAIGN_ID,
      interest_status: 1,
      limit: 5,
    }),
  });

  const data1 = await response1.json();
  console.log("Response:", JSON.stringify(data1, null, 2));

  if (data1.items && data1.items.length > 0) {
    console.log("\n--- Checking campaign_id of returned leads ---");
    for (const lead of data1.items) {
      console.log(`Lead: ${lead.email}`);
      console.log(`  - campaign_id in response: ${lead.campaign_id || lead.campaign || "NOT PRESENT"}`);
      console.log(`  - Expected campaign: ${PROVIDER_CAMPAIGN_ID}`);
      console.log(`  - Match: ${(lead.campaign_id === PROVIDER_CAMPAIGN_ID || lead.campaign === PROVIDER_CAMPAIGN_ID) ? "YES" : "NO"}`);
    }
  }

  console.log("\n=== TEST 2: Fetch WITHOUT interest_status (just campaign) ===");
  const response2 = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign: PROVIDER_CAMPAIGN_ID,
      limit: 5,
    }),
  });

  const data2 = await response2.json();
  console.log("Total items returned:", data2.items?.length || 0);
  if (data2.items && data2.items.length > 0) {
    console.log("First lead:", data2.items[0].email);
    console.log("First lead campaign_id:", data2.items[0].campaign_id || data2.items[0].campaign || "NOT PRESENT");
  }

  console.log("\n=== TEST 3: Try campaign_id instead of campaign ===");
  const response3 = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign_id: PROVIDER_CAMPAIGN_ID,
      interest_status: 1,
      limit: 5,
    }),
  });

  const data3 = await response3.json();
  console.log("Response:", JSON.stringify(data3, null, 2));

  console.log("\n=== TEST 4: Check total leads with interest_status=1 (no campaign filter) ===");
  const response4 = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      interest_status: 1,
      limit: 1,
    }),
  });

  const data4 = await response4.json();
  console.log("Response (no campaign filter):", JSON.stringify(data4, null, 2));
}

main().catch(console.error);
