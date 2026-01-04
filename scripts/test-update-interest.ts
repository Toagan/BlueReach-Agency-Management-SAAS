// Test interest status update API to understand how Instantly tracks this
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

  // First, get a test lead
  console.log("=== Fetching a test lead ===");
  const leadResponse = await fetch("https://api.instantly.ai/api/v2/leads/list", {
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
  const leadData = await leadResponse.json();
  const testEmail = leadData.items?.[0]?.email;
  console.log("Test email:", testEmail);

  // Check the update-interest-status endpoint documentation
  console.log("\n=== Testing GET /leads/update-interest-status (docs check) ===");
  const docResponse = await fetch("https://api.instantly.ai/api/v2/leads/update-interest-status", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
  console.log("Status:", docResponse.status);
  const docData = await docResponse.text();
  console.log("Response:", docData);

  // Check the /leads/interest endpoint with a lead email
  console.log("\n=== Testing GET /leads/interest with email ===");
  const interestResponse = await fetch(`https://api.instantly.ai/api/v2/leads/interest?email=${encodeURIComponent(testEmail)}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
  console.log("Status:", interestResponse.status);
  const interestData = await interestResponse.text();
  console.log("Response:", interestData);

  // Check if there's a /leads/status endpoint
  console.log("\n=== Testing POST /leads/status ===");
  const statusResponse = await fetch("https://api.instantly.ai/api/v2/leads/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: testEmail,
      campaign: PROVIDER_CAMPAIGN_ID,
    }),
  });
  console.log("Status:", statusResponse.status);
  const statusData = await statusResponse.text();
  console.log("Response:", statusData);

  // Check inbox/replies endpoint
  console.log("\n=== Testing GET /inbox/list (might have replies) ===");
  const inboxResponse = await fetch("https://api.instantly.ai/api/v2/inbox/list", {
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
  console.log("Status:", inboxResponse.status);
  const inboxData = await inboxResponse.text();
  console.log("Response:", inboxData.substring(0, 500));

  // Check unibox/emails
  console.log("\n=== Testing POST /unibox/emails ===");
  const uniboxResponse = await fetch("https://api.instantly.ai/api/v2/unibox/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign_id: PROVIDER_CAMPAIGN_ID,
      limit: 5,
      is_unread: false,
    }),
  });
  console.log("Status:", uniboxResponse.status);
  const uniboxData = await uniboxResponse.json();
  console.log("Response:", JSON.stringify(uniboxData, null, 2).substring(0, 800));
}

main().catch(console.error);
