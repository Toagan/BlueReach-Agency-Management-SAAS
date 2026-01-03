import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log("=== POSITIVE REPLY VERIFICATION ===\n");

  // 1. Get total positive replies in DB
  const { count: totalPositive } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  console.log("Total leads with is_positive_reply=true:", totalPositive);

  // 2. Get total leads in DB
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  console.log("Total leads in database:", totalLeads);

  // 3. Get breakdown by campaign
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, instantly_campaign_id")
    .not("instantly_campaign_id", "is", null);

  console.log("\n=== POSITIVE REPLIES BY CAMPAIGN ===\n");

  for (const campaign of campaigns || []) {
    const { count: positiveCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("is_positive_reply", true);

    const { count: totalCampaignLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id);

    console.log(campaign.name + ":");
    console.log("  Total leads:", totalCampaignLeads);
    console.log("  Positive replies:", positiveCount);
    console.log("");
  }

  // 4. Sample positive reply leads
  console.log("=== SAMPLE POSITIVE REPLY LEADS ===\n");
  const { data: sampleLeads } = await supabase
    .from("leads")
    .select("email, status, is_positive_reply")
    .eq("is_positive_reply", true)
    .limit(10);

  for (const lead of sampleLeads || []) {
    console.log(lead.email, "- status:", lead.status);
  }
}

verify().catch(console.error);
