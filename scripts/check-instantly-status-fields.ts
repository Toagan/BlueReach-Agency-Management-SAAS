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

async function checkStatusFields() {
  console.log("=== ANALYZING INSTANTLY LEAD STATUS FIELDS ===\n");

  // Get one campaign
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, instantly_campaign_id")
    .not("instantly_campaign_id", "is", null)
    .limit(2);

  if (!campaigns?.length) {
    console.log("No campaigns found");
    return;
  }

  for (const campaign of campaigns) {
    console.log(`\n=== Campaign: ${campaign.name} ===\n`);

    // Get many leads to analyze patterns
    let allLeads: any[] = [];
    let skip = 0;

    while (allLeads.length < 500) {
      const data = await postToInstantly("/leads/list", {
        campaign: campaign.instantly_campaign_id,
        limit: 100,
        skip,
      });

      const items = data.items || data || [];
      if (items.length === 0) break;

      allLeads.push(...items);
      skip += 100;
    }

    console.log(`Analyzed ${allLeads.length} leads\n`);

    // Count by numeric status
    const statusCounts: Record<number, number> = {};
    const statusSummaryCounts: Record<string, number> = {};

    // Track leads with replies
    const leadsWithReplies: any[] = [];
    const leadsWithOpens: any[] = [];

    for (const lead of allLeads) {
      const status = lead.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const summary = lead.status_summary || "empty";
      statusSummaryCounts[summary] = (statusSummaryCounts[summary] || 0) + 1;

      if (lead.email_reply_count > 0) {
        leadsWithReplies.push(lead);
      }
      if (lead.email_open_count > 0) {
        leadsWithOpens.push(lead);
      }
    }

    console.log("Distribution by 'status' field:");
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  status=${status}: ${count} leads`);
    }

    console.log("\nDistribution by 'status_summary' field:");
    for (const [summary, count] of Object.entries(statusSummaryCounts)) {
      console.log(`  "${summary}": ${count} leads`);
    }

    console.log(`\nLeads with email_reply_count > 0: ${leadsWithReplies.length}`);
    console.log(`Leads with email_open_count > 0: ${leadsWithOpens.length}`);

    // Show sample lead with replies
    if (leadsWithReplies.length > 0) {
      console.log("\n=== Sample leads WITH REPLIES ===");
      for (const lead of leadsWithReplies.slice(0, 3)) {
        console.log(`\n${lead.email}:`);
        console.log(`  status: ${lead.status}`);
        console.log(`  status_summary: ${lead.status_summary}`);
        console.log(`  email_reply_count: ${lead.email_reply_count}`);
        console.log(`  email_open_count: ${lead.email_open_count}`);
        console.log(`  Full lead data: ${JSON.stringify(lead, null, 2)}`);
      }
    }
  }
}

checkStatusFields().catch(console.error);
