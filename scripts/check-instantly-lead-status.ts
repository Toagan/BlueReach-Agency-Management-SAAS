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

async function checkLeadStatus() {
  console.log("=== CHECKING INSTANTLY LEAD INTEREST_STATUS VALUES ===\n");

  // Get campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, instantly_campaign_id")
    .not("instantly_campaign_id", "is", null);

  if (!campaigns?.length) {
    console.log("No campaigns found");
    return;
  }

  // Check each campaign
  for (const campaign of campaigns) {
    console.log(`\n=== Campaign: ${campaign.name} ===`);
    console.log(`Instantly ID: ${campaign.instantly_campaign_id}\n`);

    try {
      // Get leads using POST with "campaign" param
      const data = await postToInstantly("/leads/list", {
        campaign: campaign.instantly_campaign_id,
        limit: 100,
      });

      const items = data.items || data || [];
      console.log(`Fetched ${items.length} leads\n`);

      // Count by interest_status
      const statusCounts: Record<string, number> = {};
      for (const lead of items) {
        const status = lead.interest_status || "null/empty";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }

      console.log("Interest status distribution:");
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`  ${status}: ${count}`);
      }

      // Show sample lead structure
      if (items.length > 0) {
        console.log("\nSample lead structure:");
        const sampleLead = items[0];
        console.log(`  email: ${sampleLead.email}`);
        console.log(`  interest_status: ${sampleLead.interest_status}`);
        console.log(`  status: ${sampleLead.status}`);
        console.log(`  lead_status: ${sampleLead.lead_status}`);
        console.log(`  all keys: ${Object.keys(sampleLead).join(", ")}`);
      }

      // Try fetching "interested" leads specifically
      const interestedData = await postToInstantly("/leads/list", {
        campaign: campaign.instantly_campaign_id,
        limit: 100,
        interest_status: "interested",
      });

      const interestedItems = interestedData.items || interestedData || [];
      console.log(`\nLeads with interest_status="interested": ${interestedItems.length}`);

      // Also try "meeting_booked"
      const meetingBookedData = await postToInstantly("/leads/list", {
        campaign: campaign.instantly_campaign_id,
        limit: 100,
        interest_status: "meeting_booked",
      });

      const meetingBookedItems = meetingBookedData.items || meetingBookedData || [];
      console.log(`Leads with interest_status="meeting_booked": ${meetingBookedItems.length}`);

    } catch (e) {
      console.log(`Error: ${e}`);
    }
  }
}

checkLeadStatus().catch(console.error);
