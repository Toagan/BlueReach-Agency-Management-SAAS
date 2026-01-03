import { createClient } from "@supabase/supabase-js";

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const BASE_URL = "https://api.instantly.ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function postToInstantly(endpoint: string, body: Record<string, unknown>) {
  const url = `${BASE_URL}/api/v2${endpoint}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function syncPositiveReplies() {
  console.log("=== SYNCING POSITIVE REPLIES FROM INSTANTLY ===\n");
  console.log("Using lt_interest_status field: 1 = positive, 0 = neutral, -1/-2 = negative\n");

  // Get campaigns with instantly IDs
  const { data: campaigns, error: campError } = await supabase
    .from("campaigns")
    .select("id, name, instantly_campaign_id")
    .not("instantly_campaign_id", "is", null);

  if (campError || !campaigns?.length) {
    console.error("Failed to fetch campaigns:", campError);
    return;
  }

  // First, reset ALL leads to is_positive_reply=false
  console.log("Step 1: Resetting all leads to is_positive_reply=false...");
  const { error: resetError } = await supabase
    .from("leads")
    .update({ is_positive_reply: false })
    .eq("is_positive_reply", true);

  if (resetError) {
    console.error("Error resetting leads:", resetError);
  } else {
    console.log("All leads reset to is_positive_reply=false\n");
  }

  let totalPositive = 0;
  let totalUpdated = 0;
  let totalNotFound = 0;

  for (const campaign of campaigns) {
    console.log(`\n=== Processing: ${campaign.name} ===`);
    console.log(`Instantly ID: ${campaign.instantly_campaign_id}`);

    // Fetch ALL leads from Instantly for this campaign
    let allInstantlyLeads: any[] = [];
    let skip = 0;
    const limit = 100;

    while (true) {
      try {
        const data = await postToInstantly("/leads/list", {
          campaign: campaign.instantly_campaign_id,
          limit,
          skip,
        });

        const items = data.items || data || [];
        if (items.length === 0) break;

        allInstantlyLeads.push(...items);
        skip += limit;

        if (skip % 1000 === 0) {
          console.log(`  Fetched ${allInstantlyLeads.length} leads from Instantly...`);
        }

        if (items.length < limit) break;
      } catch (e) {
        console.error(`  Error fetching leads at skip=${skip}:`, e);
        break;
      }
    }

    console.log(`  Total leads from Instantly: ${allInstantlyLeads.length}`);

    // Find leads with lt_interest_status === 1 (positive)
    const positiveLeads = allInstantlyLeads.filter(lead => lead.lt_interest_status === 1);
    console.log(`  Positive leads (lt_interest_status=1): ${positiveLeads.length}`);

    totalPositive += positiveLeads.length;

    if (positiveLeads.length === 0) {
      console.log("  No positive leads to update for this campaign.");
      continue;
    }

    // Get positive lead emails
    const positiveEmails = positiveLeads.map(lead => lead.email);

    // Update in batches of 100
    const batchSize = 100;
    let campaignUpdated = 0;

    for (let i = 0; i < positiveEmails.length; i += batchSize) {
      const batch = positiveEmails.slice(i, i + batchSize);

      const { data: updated, error } = await supabase
        .from("leads")
        .update({ is_positive_reply: true })
        .eq("campaign_id", campaign.id)
        .in("email", batch)
        .select("id");

      if (error) {
        console.error(`  Error updating batch:`, error.message);
      } else if (updated) {
        campaignUpdated += updated.length;
      }
    }

    const notFoundCount = positiveLeads.length - campaignUpdated;
    console.log(`  Updated to positive: ${campaignUpdated}`);
    console.log(`  Not found in DB: ${notFoundCount}`);

    totalUpdated += campaignUpdated;
    totalNotFound += notFoundCount;
  }

  console.log("\n=== SYNC COMPLETE ===");
  console.log(`Total positive leads in Instantly: ${totalPositive}`);
  console.log(`Total updated in DB: ${totalUpdated}`);
  console.log(`Total not found in DB: ${totalNotFound}`);

  // Final verification
  const { count: dbPositiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  console.log(`\nFinal DB count of is_positive_reply=true: ${dbPositiveCount}`);

  // Show breakdown by campaign
  console.log("\n=== BREAKDOWN BY CAMPAIGN ===");
  for (const campaign of campaigns) {
    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("is_positive_reply", true);

    console.log(`${campaign.name}: ${count} positive leads`);
  }
}

syncPositiveReplies().catch(console.error);
