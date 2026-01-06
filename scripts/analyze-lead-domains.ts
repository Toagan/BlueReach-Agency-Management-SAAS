// Analyze lead domains to understand the discrepancy
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

  // Analyze TLDs in Supabase
  console.log("=== ANALYZING LEAD DOMAINS IN SUPABASE ===");
  const tldCounts = new Map<string, number>();
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch } = await supabase
      .from("leads")
      .select("email")
      .eq("campaign_id", CAMPAIGN_ID)
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;

    for (const lead of batch) {
      const email = lead.email || "";
      const domain = email.split("@")[1] || "";
      const tld = domain.split(".").pop() || "unknown";
      tldCounts.set(tld, (tldCounts.get(tld) || 0) + 1);
    }

    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  console.log("\nLeads by TLD:");
  const sortedTlds = [...tldCounts.entries()].sort((a, b) => b[1] - a[1]);
  sortedTlds.forEach(([tld, count]) => {
    const pct = ((count / 36196) * 100).toFixed(1);
    console.log(`  .${tld}: ${count} (${pct}%)`);
  });

  // Get sample of .de emails vs .com emails
  console.log("\n=== SAMPLE .DE EMAILS (German) ===");
  const { data: deLeads } = await supabase
    .from("leads")
    .select("email, instantly_lead_id, created_at")
    .eq("campaign_id", CAMPAIGN_ID)
    .ilike("email", "%.de")
    .limit(5);

  deLeads?.forEach(l => console.log(`  ${l.email} | ${l.instantly_lead_id?.substring(0, 8)}...`));

  console.log("\n=== SAMPLE .COM EMAILS (US/International) ===");
  const { data: comLeads } = await supabase
    .from("leads")
    .select("email, instantly_lead_id, created_at")
    .eq("campaign_id", CAMPAIGN_ID)
    .ilike("email", "%.com")
    .limit(5);

  comLeads?.forEach(l => console.log(`  ${l.email} | ${l.instantly_lead_id?.substring(0, 8)}...`));

  // Count .de vs others
  const deCount = tldCounts.get("de") || 0;
  const otherCount = 36196 - deCount;

  console.log("\n=== SUMMARY ===");
  console.log(`German (.de) leads: ${deCount}`);
  console.log(`Other leads: ${otherCount}`);
  console.log(`\nInstantly has: 18,096 leads (German cleaning companies)`);

  // Check if .de count matches Instantly
  if (Math.abs(deCount - 18096) < 100) {
    console.log(`\n✅ HYPOTHESIS CONFIRMED!`);
    console.log(`The ~18,000 .de leads are from Instantly.`);
    console.log(`The ~18,000 other leads were imported from a different source.`);
    console.log(`\nRECOMMENDATION: Delete the non-.de leads or create a separate campaign for them.`);
  }

  // Verify by checking if .de leads exist in Instantly
  console.log("\n=== VERIFYING .DE LEADS ARE IN INSTANTLY ===");
  for (const lead of (deLeads || []).slice(0, 3)) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
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
    const data = await response.json();
    const found = data.items?.length > 0;
    console.log(`  ${lead.email}: ${found ? "FOUND ✅" : "NOT FOUND ❌"}`);
  }

  console.log("\n=== VERIFYING .COM LEADS ARE NOT IN INSTANTLY ===");
  for (const lead of (comLeads || []).slice(0, 3)) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
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
    const data = await response.json();
    const found = data.items?.length > 0;
    console.log(`  ${lead.email}: ${found ? "FOUND ⚠️" : "NOT FOUND (expected) ✅"}`);
  }
}

main().catch(console.error);
