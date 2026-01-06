import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load .env.local
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkPositive() {
  // Count all leads
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  console.log(`Total leads in database: ${totalLeads}`);

  // Count positive leads
  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  console.log(`Leads with is_positive_reply=true: ${positiveCount}`);

  // Count by campaign
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name");

  console.log("\nLeads by campaign:");
  for (const camp of campaigns || []) {
    const { count: posCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", camp.id)
      .eq("is_positive_reply", true);

    const { count: totalCamp } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", camp.id);

    console.log(`  ${camp.name}: ${posCount} positive / ${totalCamp} total`);
  }

  // Sample positive leads
  const { data: posLeads } = await supabase
    .from("leads")
    .select("id, email, is_positive_reply, status, client_id")
    .eq("is_positive_reply", true)
    .limit(5);

  console.log("\nSample positive leads:", JSON.stringify(posLeads, null, 2));

  // Sample any leads
  const { data: anyLeads } = await supabase
    .from("leads")
    .select("id, email, is_positive_reply, status, client_id")
    .limit(3);

  console.log("\nSample any leads:", JSON.stringify(anyLeads, null, 2));
}

checkPositive().catch(console.error);
