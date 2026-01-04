// Try to find the correct Instantly API endpoint for opportunities/positive leads
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

  const endpoints = [
    { method: "GET", url: `/api/v2/campaigns/${PROVIDER_CAMPAIGN_ID}/opportunities` },
    { method: "GET", url: `/api/v2/opportunities?campaign_id=${PROVIDER_CAMPAIGN_ID}` },
    { method: "GET", url: `/api/v2/opportunities?campaign=${PROVIDER_CAMPAIGN_ID}` },
    { method: "GET", url: `/api/v2/leads/opportunities?campaign=${PROVIDER_CAMPAIGN_ID}` },
    { method: "POST", url: `/api/v2/leads/list/opportunities`, body: { campaign: PROVIDER_CAMPAIGN_ID } },
    { method: "GET", url: `/api/v2/campaigns/${PROVIDER_CAMPAIGN_ID}/leads?interest_status=1` },
    { method: "GET", url: `/api/v2/leads?campaign=${PROVIDER_CAMPAIGN_ID}&interest_status=1` },
    // Try v1 API
    { method: "GET", url: `/api/v1/lead/list?campaign_id=${PROVIDER_CAMPAIGN_ID}&interest_status=1&api_key=${apiKey}`, noAuth: true },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n=== ${endpoint.method} ${endpoint.url.substring(0, 80)}... ===`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!endpoint.noAuth) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`https://api.instantly.ai${endpoint.url}`, {
      method: endpoint.method,
      headers,
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });

    console.log("Status:", response.status);
    const data = await response.text();
    console.log("Response:", data.substring(0, 300));
  }

  // Also check if we can get lead details that include interest_status
  console.log("\n=== Fetch single lead to see full schema ===");
  const leadListResponse = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign: PROVIDER_CAMPAIGN_ID,
      limit: 1,
    }),
  });
  const leadList = await leadListResponse.json();
  if (leadList.items?.[0]) {
    const leadId = leadList.items[0].id;
    console.log(`Lead ID: ${leadId}`);

    // Get full lead details
    const leadDetailResponse = await fetch(`https://api.instantly.ai/api/v2/leads/${leadId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    console.log("Lead detail status:", leadDetailResponse.status);
    const leadDetail = await leadDetailResponse.json();
    console.log("Lead full schema:", JSON.stringify(leadDetail, null, 2));
  }
}

main().catch(console.error);
