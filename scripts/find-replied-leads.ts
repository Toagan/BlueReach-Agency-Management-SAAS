// Find leads with replies (email_reply_count > 0)
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

  console.log("=== Fetching leads to find those with replies ===");

  // Fetch leads in batches and count those with email_reply_count > 0
  let totalLeads = 0;
  let leadsWithReplies = 0;
  let skip = 0;
  const limit = 100;
  const repliedLeads: Array<{ email: string; reply_count: number; id: string }> = [];

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

    for (const lead of leads) {
      totalLeads++;
      if (lead.email_reply_count > 0) {
        leadsWithReplies++;
        repliedLeads.push({
          email: lead.email,
          reply_count: lead.email_reply_count,
          id: lead.id,
        });
      }
    }

    if (leads.length < limit) break;
    skip += limit;

    // Progress log
    if (skip % 1000 === 0) {
      console.log(`  Processed ${skip} leads... (${leadsWithReplies} with replies so far)`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Total leads scanned: ${totalLeads}`);
  console.log(`Leads with email_reply_count > 0: ${leadsWithReplies}`);
  console.log(`\nFirst 20 replied leads:`);
  repliedLeads.slice(0, 20).forEach(l => {
    console.log(`  ${l.email} (${l.reply_count} replies, ID: ${l.id})`);
  });

  // Now update these in Supabase
  if (repliedLeads.length > 0) {
    console.log(`\n=== Updating ${repliedLeads.length} leads in Supabase ===`);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const lead of repliedLeads) {
      // Try to update by instantly_lead_id first
      const { data: updated } = await supabase
        .from("leads")
        .update({
          has_replied: true,
          email_reply_count: lead.reply_count,
        })
        .eq("campaign_id", CAMPAIGN_ID)
        .eq("instantly_lead_id", lead.id)
        .select("id");

      if (updated && updated.length > 0) {
        updatedCount++;
      } else {
        // Fall back to email
        const { data: emailUpdated } = await supabase
          .from("leads")
          .update({
            has_replied: true,
            email_reply_count: lead.reply_count,
            instantly_lead_id: lead.id, // Backfill
          })
          .eq("campaign_id", CAMPAIGN_ID)
          .ilike("email", lead.email.toLowerCase())
          .select("id");

        if (emailUpdated && emailUpdated.length > 0) {
          updatedCount++;
        } else {
          notFoundCount++;
        }
      }
    }

    console.log(`Updated: ${updatedCount}`);
    console.log(`Not found: ${notFoundCount}`);
  }

  // Final count
  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("has_replied", true);

  console.log(`\nFinal has_replied=true count: ${positiveCount}`);
}

main().catch(console.error);
