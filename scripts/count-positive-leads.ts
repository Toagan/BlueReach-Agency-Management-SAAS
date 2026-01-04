// Count positive leads from Instantly API
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

  // Count leads WITH interest_status=1 filter
  console.log("=== Counting leads WITH interest_status=1 filter ===");
  let countWithFilter = 0;
  let skip = 0;
  const limit = 100;

  while (true) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        campaign: PROVIDER_CAMPAIGN_ID,
        interest_status: 1,
        limit,
        skip,
      }),
    });

    const data = await response.json();
    const leads = data.items || [];
    countWithFilter += leads.length;

    if (leads.length < limit) break;
    skip += limit;

    if (skip > 500) {
      console.log(`  ...stopped at ${countWithFilter} (would keep going)`);
      break;
    }
  }

  console.log(`Total with interest_status=1: ${countWithFilter}${skip > 500 ? '+' : ''}`);

  // Count leads WITHOUT interest_status filter
  console.log("\n=== Counting leads WITHOUT interest_status filter (first 500) ===");
  let countWithoutFilter = 0;
  skip = 0;

  while (true) {
    const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        campaign: PROVIDER_CAMPAIGN_ID,
        limit,
        skip,
      }),
    });

    const data = await response.json();
    const leads = data.items || [];
    countWithoutFilter += leads.length;

    if (leads.length < limit) break;
    skip += limit;

    if (skip > 500) {
      console.log(`  ...stopped at ${countWithoutFilter} (would keep going)`);
      break;
    }
  }

  console.log(`Total without filter: ${countWithoutFilter}${skip > 500 ? '+' : ''}`);

  // Check analytics for comparison
  console.log("\n=== Analytics endpoint ===");
  const analyticsResponse = await fetch(`https://api.instantly.ai/api/v2/campaigns/analytics?id=${PROVIDER_CAMPAIGN_ID}`, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  const analytics = await analyticsResponse.json();
  console.log("Analytics response:", JSON.stringify(analytics, null, 2));
}

main().catch(console.error);
