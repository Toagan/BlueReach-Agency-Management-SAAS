// Investigate where extra leads came from
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

  // Get campaign API key
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("api_key_encrypted")
    .eq("id", CAMPAIGN_ID)
    .single();

  const apiKey = campaign?.api_key_encrypted;

  // Get sample leads from Supabase
  console.log("=== SAMPLE LEADS FROM SUPABASE ===");
  const { data: sampleLeads } = await supabase
    .from("leads")
    .select("email, instantly_lead_id, created_at")
    .eq("campaign_id", CAMPAIGN_ID)
    .order("created_at", { ascending: true })
    .limit(5);

  console.log("First 5 leads (oldest):");
  sampleLeads?.forEach(l => console.log(`  ${l.email} | ${l.instantly_lead_id} | ${l.created_at}`));

  const { data: newestLeads } = await supabase
    .from("leads")
    .select("email, instantly_lead_id, created_at")
    .eq("campaign_id", CAMPAIGN_ID)
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\nLast 5 leads (newest):");
  newestLeads?.forEach(l => console.log(`  ${l.email} | ${l.instantly_lead_id} | ${l.created_at}`));

  // Check how many different campaigns exist
  console.log("\n=== CAMPAIGNS IN DATABASE ===");
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, provider_campaign_id, instantly_campaign_id");

  campaigns?.forEach(c => {
    console.log(`  ${c.name}`);
    console.log(`    ID: ${c.id}`);
    console.log(`    Provider ID: ${c.provider_campaign_id || c.instantly_campaign_id || "none"}`);
  });

  // Check leads by created_at date
  console.log("\n=== LEADS BY CREATION DATE ===");
  const { data: leadsByDate } = await supabase
    .from("leads")
    .select("created_at")
    .eq("campaign_id", CAMPAIGN_ID);

  const dateMap = new Map<string, number>();
  leadsByDate?.forEach(l => {
    const date = l.created_at?.split("T")[0] || "unknown";
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });

  const sortedDates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  sortedDates.forEach(([date, count]) => {
    console.log(`  ${date}: ${count} leads`);
  });

  // Fetch sample from Instantly to compare
  console.log("\n=== SAMPLE FROM INSTANTLY API ===");
  const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      campaign: PROVIDER_CAMPAIGN_ID,
      limit: 5,
    }),
  });

  const data = await response.json();
  console.log("First 5 leads from Instantly:");
  (data.items || []).forEach((l: any) => {
    console.log(`  ${l.email} | ${l.id} | created: ${l.timestamp_created}`);
  });

  // Check if Supabase emails exist in Instantly
  console.log("\n=== CHECKING IF SUPABASE LEADS EXIST IN INSTANTLY ===");

  // Get 10 random Supabase leads
  const { data: randomLeads } = await supabase
    .from("leads")
    .select("email, instantly_lead_id")
    .eq("campaign_id", CAMPAIGN_ID)
    .limit(10);

  for (const lead of randomLeads || []) {
    // Try to find this lead in Instantly
    const searchResponse = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        campaign: PROVIDER_CAMPAIGN_ID,
        search: lead.email,
        limit: 1,
      }),
    });

    const searchData = await searchResponse.json();
    const found = searchData.items?.length > 0;
    console.log(`  ${lead.email}: ${found ? "FOUND" : "NOT FOUND"} in Instantly`);
  }

  // Check leads with NULL or missing instantly_lead_id
  console.log("\n=== LEADS WITHOUT INSTANTLY_LEAD_ID ===");
  const { count: nullIdCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .is("instantly_lead_id", null);

  const { count: emptyIdCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("instantly_lead_id", "");

  console.log(`Leads with NULL instantly_lead_id: ${nullIdCount}`);
  console.log(`Leads with empty string instantly_lead_id: ${emptyIdCount}`);
}

main().catch(console.error);
