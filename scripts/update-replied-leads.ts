// Update leads with has_replied=true based on email_reply_count from Instantly
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const PROVIDER_CAMPAIGN_ID = "01c2efd7-8db4-4d39-8dab-e85a40a77e1c";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  console.log("=== Fetching ALL leads to find those with replies ===");
  console.log("This will take a few minutes...\n");

  let totalLeads = 0;
  let leadsWithReplies = 0;
  let skip = 0;
  const limit = 100;
  const repliedLeads: Array<{ email: string; reply_count: number; id: string }> = [];
  let errorCount = 0;

  while (true) {
    try {
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

      // Check for rate limiting
      if (response.status === 429) {
        console.log("Rate limited, waiting 60 seconds...");
        await sleep(60000);
        continue;
      }

      // Check for HTML error pages
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.log(`Non-JSON response at skip=${skip}, waiting 30 seconds...`);
        errorCount++;
        if (errorCount > 5) {
          console.log("Too many errors, stopping fetch.");
          break;
        }
        await sleep(30000);
        continue;
      }

      errorCount = 0; // Reset on success
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

      if (leads.length < limit) {
        console.log(`Reached end of leads at skip=${skip}`);
        break;
      }
      skip += limit;

      // Progress log
      if (skip % 1000 === 0) {
        console.log(`Processed ${skip} leads... (${leadsWithReplies} with replies)`);
      }

      // Small delay to avoid rate limiting
      await sleep(100);

    } catch (err) {
      console.error(`Error at skip=${skip}:`, err);
      errorCount++;
      if (errorCount > 5) {
        console.log("Too many errors, stopping fetch.");
        break;
      }
      await sleep(30000);
    }
  }

  console.log(`\n=== Fetch Results ===`);
  console.log(`Total leads scanned: ${totalLeads}`);
  console.log(`Leads with email_reply_count > 0: ${leadsWithReplies}`);

  // Show sample
  console.log(`\nSample of replied leads:`);
  repliedLeads.slice(0, 10).forEach(l => {
    console.log(`  ${l.email} (${l.reply_count} replies)`);
  });

  // Update Supabase
  if (repliedLeads.length > 0) {
    console.log(`\n=== Updating ${repliedLeads.length} leads in Supabase ===`);

    let updatedById = 0;
    let updatedByEmail = 0;
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
        updatedById++;
      } else {
        // Fall back to email
        const { data: emailUpdated } = await supabase
          .from("leads")
          .update({
            has_replied: true,
            email_reply_count: lead.reply_count,
            instantly_lead_id: lead.id,
            provider_lead_id: lead.id,
          })
          .eq("campaign_id", CAMPAIGN_ID)
          .ilike("email", lead.email.toLowerCase().trim())
          .select("id");

        if (emailUpdated && emailUpdated.length > 0) {
          updatedByEmail++;
        } else {
          notFoundCount++;
          console.log(`  Not found: ${lead.email}`);
        }
      }
    }

    console.log(`\n=== Update Results ===`);
    console.log(`Updated by ID: ${updatedById}`);
    console.log(`Updated by email (+ ID backfill): ${updatedByEmail}`);
    console.log(`Not found: ${notFoundCount}`);
    console.log(`Total updated: ${updatedById + updatedByEmail}`);
  }

  // Final counts
  console.log(`\n=== Final Supabase Counts ===`);

  const { count: repliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("has_replied", true);

  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("is_positive_reply", true);

  console.log(`has_replied=true: ${repliedCount}`);
  console.log(`is_positive_reply=true: ${positiveCount}`);
}

main().catch(console.error);
