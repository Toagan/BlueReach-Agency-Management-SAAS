/**
 * Sync Reply Counts from Instantly
 *
 * This script fetches email_reply_count from the Instantly API for all leads
 * and updates the database, setting has_replied = true for leads with replies.
 *
 * The bug was that the provider sync wasn't mapping email_reply_count from the API,
 * so has_replied was only being set for positive leads, not ALL leads who replied.
 *
 * Usage:
 *   DRY RUN (default): npx tsx scripts/sync-reply-counts-from-instantly.ts
 *   LIVE RUN:          npx tsx scripts/sync-reply-counts-from-instantly.ts --execute
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InstantlyLead {
  id: string;
  email: string;
  email_reply_count: number;
  lt_interest_status?: number;
  status?: number;
}

async function fetchLeadsFromInstantly(apiKey: string, campaignId: string): Promise<InstantlyLead[]> {
  const allLeads: InstantlyLead[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    try {
      const response = await fetch("https://api.instantly.ai/api/v2/leads/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          campaign: campaignId,
          limit,
          skip,
        }),
      });

      if (!response.ok) {
        if (response.status === 502) {
          // Rate limit or server error - wait and retry once
          console.log(`  Rate limited at skip=${skip}, waiting 5s...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }
        console.error(`  API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      const leads = data.items || [];

      if (leads.length === 0) break;

      allLeads.push(...leads);
      skip += limit;

      // Progress logging
      if (skip % 500 === 0) {
        console.log(`  Fetched ${skip} leads...`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`  Error at skip=${skip}:`, err);
      break;
    }
  }

  return allLeads;
}

async function syncReplyCounts(dryRun: boolean) {
  console.log("=".repeat(60));
  console.log("SYNC REPLY COUNTS FROM INSTANTLY");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE EXECUTION"}`);
  console.log("");

  // Step 1: Get current state
  console.log("[Step 1] Fetching current state...\n");

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: hasRepliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("has_replied", true);

  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  console.log(`  Total leads in DB: ${totalLeads}`);
  console.log(`  has_replied = true: ${hasRepliedCount}`);
  console.log(`  is_positive_reply = true: ${positiveCount}`);
  console.log("");

  // Step 2: Get all campaigns with API keys
  console.log("[Step 2] Fetching campaigns with API keys...\n");

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, name, provider_campaign_id, instantly_campaign_id, api_key_encrypted")
    .not("api_key_encrypted", "is", null)
    .eq("provider_type", "instantly");

  if (campaignsError || !campaigns) {
    console.error("ERROR: Failed to fetch campaigns:", campaignsError);
    return;
  }

  console.log(`  Found ${campaigns.length} Instantly campaigns with API keys\n`);

  // Step 3: Process each campaign
  let totalRepliedLeads = 0;
  let totalUpdated = 0;
  let totalNotFound = 0;

  const leadsToUpdate: Array<{
    email: string;
    campaignId: string;
    replyCount: number;
  }> = [];

  for (const campaign of campaigns) {
    const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;
    if (!providerCampaignId) continue;

    console.log(`[Campaign] ${campaign.name}`);
    console.log(`  Provider ID: ${providerCampaignId}`);

    // Fetch leads from Instantly
    const instantlyLeads = await fetchLeadsFromInstantly(
      campaign.api_key_encrypted!,
      providerCampaignId
    );

    console.log(`  Fetched ${instantlyLeads.length} leads from Instantly`);

    // Find leads with replies
    const repliedLeads = instantlyLeads.filter((l) => l.email_reply_count > 0);
    console.log(`  Leads with email_reply_count > 0: ${repliedLeads.length}`);
    totalRepliedLeads += repliedLeads.length;

    // Queue updates
    for (const lead of repliedLeads) {
      leadsToUpdate.push({
        email: lead.email.toLowerCase().trim(),
        campaignId: campaign.id,
        replyCount: lead.email_reply_count,
      });
    }

    console.log("");
  }

  console.log("=".repeat(60));
  console.log(`Total leads with replies across all campaigns: ${totalRepliedLeads}`);
  console.log(`Leads to update: ${leadsToUpdate.length}`);
  console.log("=".repeat(60));
  console.log("");

  // Step 4: Show sample
  if (leadsToUpdate.length > 0) {
    console.log("[Step 4] Sample of leads to be updated (first 10):\n");
    for (const lead of leadsToUpdate.slice(0, 10)) {
      console.log(`  - ${lead.email}`);
      console.log(`    email_reply_count: ${lead.replyCount}`);
      console.log(`    will set has_replied = true`);
      console.log("");
    }

    if (leadsToUpdate.length > 10) {
      console.log(`  ... and ${leadsToUpdate.length - 10} more\n`);
    }
  }

  // Safety: Statuses that should NOT be overwritten
  const PROTECTED_STATUSES = ["unsubscribed", "bounced"];
  let totalSkippedProtected = 0;

  // Step 5: Execute updates
  if (dryRun) {
    console.log("[Step 5] DRY RUN - No changes made\n");
    console.log("  To execute the fix, run:");
    console.log("  npx tsx scripts/sync-reply-counts-from-instantly.ts --execute\n");
  } else {
    console.log("[Step 5] Executing updates...\n");
    console.log(`  Safety: Will skip leads with status in [${PROTECTED_STATUSES.join(", ")}]\n`);

    for (const lead of leadsToUpdate) {
      const { data: existingLead, error: findError } = await supabase
        .from("leads")
        .select("id, has_replied, email_reply_count, status")
        .eq("campaign_id", lead.campaignId)
        .ilike("email", lead.email)
        .maybeSingle();

      if (findError) {
        console.error(`  Error finding lead ${lead.email}:`, findError);
        continue;
      }

      if (!existingLead) {
        totalNotFound++;
        continue;
      }

      // SAFETY CHECK: Do not update leads with protected statuses
      if (existingLead.status && PROTECTED_STATUSES.includes(existingLead.status)) {
        totalSkippedProtected++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          email_reply_count: Math.max(lead.replyCount, existingLead.email_reply_count || 0),
          has_replied: true,
        })
        .eq("id", existingLead.id);

      if (updateError) {
        console.error(`  Error updating lead ${lead.email}:`, updateError);
      } else {
        totalUpdated++;
      }

      // Progress logging
      if (totalUpdated % 20 === 0 && totalUpdated > 0) {
        console.log(`  Updated ${totalUpdated}/${leadsToUpdate.length} leads...`);
      }
    }

    console.log("");
    console.log(`  Successfully updated: ${totalUpdated} leads`);
    console.log(`  Skipped (protected status): ${totalSkippedProtected} leads`);
    console.log(`  Not found in DB: ${totalNotFound} leads`);
  }

  // Step 6: Verify
  console.log("\n[Step 6] Verification...\n");

  const { count: newHasRepliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("has_replied", true);

  console.log("  Before sync:");
  console.log(`    has_replied = true: ${hasRepliedCount}`);
  console.log("");
  console.log("  After sync:");
  console.log(`    has_replied = true: ${newHasRepliedCount}`);
  console.log("");

  if (dryRun) {
    console.log("  (Expected after live run):");
    console.log(`    has_replied = true: ~${(hasRepliedCount || 0) + leadsToUpdate.length}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("COMPLETE");
  console.log("=".repeat(60));
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveRun = args.includes("--execute") || args.includes("--live") || args.includes("-x");

syncReplyCounts(!isLiveRun).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
