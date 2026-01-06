// Count leads by their lt_interest_status value (client-side filtering)
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

  const apiKey = campaign?.api_key_encrypted!;

  console.log("=== Fetching ALL leads and counting by lt_interest_status ===\n");

  const statusCounts: Record<string, number> = {};
  const leadsByStatus: Record<string, Array<{ email: string; reply_count: number }>> = {};

  let skip = 0;
  const limit = 100;
  let totalLeads = 0;

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

    if (!response.ok) {
      console.log(`Error at skip=${skip}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const leads = data.items || [];

    for (const lead of leads) {
      totalLeads++;

      // Get lt_interest_status (or "undefined" if not present)
      const status = lead.lt_interest_status !== undefined
        ? String(lead.lt_interest_status)
        : "undefined";

      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Store first 10 leads for each status
      if (!leadsByStatus[status]) {
        leadsByStatus[status] = [];
      }
      if (leadsByStatus[status].length < 10) {
        leadsByStatus[status].push({
          email: lead.email,
          reply_count: lead.email_reply_count || 0,
        });
      }
    }

    if (leads.length < limit) break;
    skip += limit;

    if (skip % 2000 === 0) {
      console.log(`Processed ${skip} leads...`);
    }
  }

  console.log(`\nTotal leads scanned: ${totalLeads}\n`);

  console.log("=== COUNT BY lt_interest_status ===\n");

  // Sort by count descending
  const sortedStatuses = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1]);

  for (const [status, count] of sortedStatuses) {
    const marker = count >= 50 && count <= 60 ? " ← POSSIBLE 55!" : "";
    console.log(`  lt_interest_status = ${status}: ${count} leads${marker}`);
  }

  console.log("\n=== SAMPLE LEADS FOR EACH STATUS ===\n");

  for (const [status, leads] of Object.entries(leadsByStatus)) {
    if (status !== "undefined") {
      console.log(`lt_interest_status = ${status}:`);
      leads.slice(0, 5).forEach(l => {
        console.log(`  - ${l.email} (${l.reply_count} replies)`);
      });
      console.log();
    }
  }

  // Summary
  console.log("=== SUMMARY ===");
  console.log(`Expected from analytics: 55 opportunities`);
  console.log(`\nlt_interest_status distribution:`);
  for (const [status, count] of sortedStatuses) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch(console.error);
