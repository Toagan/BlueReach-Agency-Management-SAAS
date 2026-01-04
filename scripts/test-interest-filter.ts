// Test different interest_status filter formats
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

  const apiKey = campaign?.api_key_encrypted;

  const testCases = [
    { label: "interest_status: 1 (number)", body: { campaign: PROVIDER_CAMPAIGN_ID, interest_status: 1, limit: 5 } },
    { label: "interest_status: '1' (string)", body: { campaign: PROVIDER_CAMPAIGN_ID, interest_status: "1", limit: 5 } },
    { label: "interest_status: 'interested'", body: { campaign: PROVIDER_CAMPAIGN_ID, interest_status: "interested", limit: 5 } },
    { label: "interest_status: 'Interested'", body: { campaign: PROVIDER_CAMPAIGN_ID, interest_status: "Interested", limit: 5 } },
    { label: "filter[interest_status]: 1", body: { campaign: PROVIDER_CAMPAIGN_ID, "filter[interest_status]": 1, limit: 5 } },
    { label: "filters: { interest_status: 1 }", body: { campaign: PROVIDER_CAMPAIGN_ID, filters: { interest_status: 1 }, limit: 5 } },
    { label: "is_interested: true", body: { campaign: PROVIDER_CAMPAIGN_ID, is_interested: true, limit: 5 } },
    { label: "lead_interest_status: 1", body: { campaign: PROVIDER_CAMPAIGN_ID, lead_interest_status: 1, limit: 5 } },
  ];

  for (const test of testCases) {
    console.log(`\n=== ${test.label} ===`);
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(test.body),
    });

    const data = await response.json();
    if (data.error) {
      console.log("Error:", data.error);
    } else {
      console.log("Leads returned:", data.items?.length || 0);
      if (data.items?.length > 0) {
        console.log("First email:", data.items[0].email);
      }
    }
  }

  // Also try the /leads/interest endpoint if it exists
  console.log("\n=== Try /leads/interest endpoint ===");
  const interestResponse = await fetch("https://api.instantly.ai/api/v2/leads/interest", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
  console.log("Status:", interestResponse.status);
  const interestData = await interestResponse.text();
  console.log("Response:", interestData.substring(0, 500));

  // Try leads/search endpoint
  console.log("\n=== Try /leads/search endpoint ===");
  const searchResponse = await fetch("https://api.instantly.ai/api/v2/leads/search", {
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
  console.log("Status:", searchResponse.status);
  const searchData = await searchResponse.text();
  console.log("Response:", searchData.substring(0, 500));
}

main().catch(console.error);
