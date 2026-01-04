import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyze() {
  // Get campaign
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, cached_positive_count")
    .ilike("name", "%Almaron%");

  console.log("Campaigns:", JSON.stringify(campaigns, null, 2));

  if (!campaigns || campaigns.length === 0) {
    console.log("No campaigns found");
    return;
  }

  const campaignId = campaigns[0].id;

  // Count positive leads in DB
  const { count: dbPositive } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_positive_reply", true);

  console.log("\n=== ANALYSIS ===");
  console.log("DB positive count:", dbPositive);
  console.log("Cached positive count:", campaigns[0].cached_positive_count);
  console.log("Difference:", (campaigns[0].cached_positive_count || 0) - (dbPositive || 0));

  // The 55 vs 54 discrepancy: check if cached count is accurate or just stale
  // Query for all positive leads to verify
  const { data: positiveLeads } = await supabase
    .from("leads")
    .select("email, is_positive_reply")
    .eq("campaign_id", campaignId)
    .eq("is_positive_reply", true)
    .order("email");

  console.log("\nPositive leads in DB:", positiveLeads?.length);

  // Check if cached_positive_count matches reality
  if (campaigns[0].cached_positive_count !== dbPositive) {
    console.log("\n*** DISCREPANCY FOUND ***");
    console.log("The cached_positive_count from Instantly may be stale or incorrect.");
    console.log("Actual DB count should be used as source of truth.");
  }
}

analyze().catch(console.error);
