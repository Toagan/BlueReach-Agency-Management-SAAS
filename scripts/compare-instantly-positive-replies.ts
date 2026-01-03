import { createClient } from "@supabase/supabase-js";

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const BASE_URL = "https://api.instantly.ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchFromInstantly(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function getPositiveRepliesFromInstantly(campaignId: string): Promise<number> {
  let count = 0;
  let skip = 0;
  const limit = 100;

  while (true) {
    const data = await fetchFromInstantly("/api/v2/leads/list", {
      campaign_id: campaignId,
      limit: String(limit),
      skip: String(skip),
      interest_status: "interested", // This gets positive replies
    });

    const items = data.items || data || [];
    if (items.length === 0) break;

    count += items.length;
    skip += limit;

    if (items.length < limit) break;
  }

  return count;
}

async function comparePositiveReplies() {
  console.log("=== COMPARING POSITIVE REPLIES: INSTANTLY vs DATABASE ===\n");

  // Get campaigns with instantly IDs
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, instantly_campaign_id")
    .not("instantly_campaign_id", "is", null);

  for (const campaign of campaigns || []) {
    console.log(`Campaign: ${campaign.name}`);
    console.log(`Instantly ID: ${campaign.instantly_campaign_id}`);

    // Count in our DB
    const { count: dbCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("is_positive_reply", true);

    console.log(`  DB positive replies: ${dbCount}`);

    // Get analytics from Instantly (which shows interested count)
    try {
      const analytics = await fetchFromInstantly("/api/v2/campaigns/analytics", {
        campaign_id: campaign.instantly_campaign_id!,
      });

      const data = analytics[0] || analytics;
      console.log(`  Instantly analytics:`);
      console.log(`    - total_interested: ${data.total_interested || 0}`);
      console.log(`    - reply_count_unique: ${data.reply_count_unique || 0}`);
      console.log(`    - total_meeting_booked: ${data.total_meeting_booked || 0}`);
      console.log(`    - total_opportunities: ${data.total_opportunities || 0}`);
    } catch (e) {
      console.log(`  Error fetching analytics: ${e}`);
    }

    console.log("");
  }
}

comparePositiveReplies().catch(console.error);
