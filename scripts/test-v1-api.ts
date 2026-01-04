// Try Instantly v1 API which might have different parameters
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

  // Try v1 API - different base path and auth method
  const v1Endpoints = [
    `/api/v1/lead/list?api_key=${apiKey}&campaign_id=${PROVIDER_CAMPAIGN_ID}&interest_status=1&limit=5`,
    `/api/v1/lead/list?api_key=${apiKey}&campaign_id=${PROVIDER_CAMPAIGN_ID}&limit=5`,
    `/api/v1/lead/get?api_key=${apiKey}&campaign_id=${PROVIDER_CAMPAIGN_ID}&limit=5`,
    `/api/v1/leads/list?api_key=${apiKey}&campaign_id=${PROVIDER_CAMPAIGN_ID}&interest_status=1&limit=5`,
    `/v1/lead/list?api_key=${apiKey}&campaign_id=${PROVIDER_CAMPAIGN_ID}&interest_status=1&limit=5`,
  ];

  for (const endpoint of v1Endpoints) {
    console.log(`\n=== GET ${endpoint.substring(0, 80)}... ===`);

    const response = await fetch(`https://api.instantly.ai${endpoint}`);
    console.log("Status:", response.status);
    const data = await response.text();
    console.log("Response:", data.substring(0, 400));
  }

  // Try the documented v1 lead list POST endpoint
  console.log("\n=== POST v1 /lead/list ===");
  const v1PostResponse = await fetch("https://api.instantly.ai/api/v1/lead/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      campaign_id: PROVIDER_CAMPAIGN_ID,
      interest_status: 1,
      limit: 5,
    }),
  });
  console.log("Status:", v1PostResponse.status);
  const v1PostData = await v1PostResponse.text();
  console.log("Response:", v1PostData.substring(0, 500));

  // Try without interest_status to compare
  console.log("\n=== POST v1 /lead/list (no filter) ===");
  const v1PostNoFilter = await fetch("https://api.instantly.ai/api/v1/lead/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      campaign_id: PROVIDER_CAMPAIGN_ID,
      limit: 5,
    }),
  });
  console.log("Status:", v1PostNoFilter.status);
  const v1PostNoFilterData = await v1PostNoFilter.text();
  console.log("Response:", v1PostNoFilterData.substring(0, 500));
}

main().catch(console.error);
