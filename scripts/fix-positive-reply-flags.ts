/**
 * Fix Positive Reply Flags
 *
 * This script repairs incorrectly marked is_positive_reply flags.
 * Due to a bug in the Instantly API v2, all replied leads were being
 * marked as positive instead of only truly positive ones.
 *
 * Usage:
 *   DRY RUN (default): npx tsx scripts/fix-positive-reply-flags.ts
 *   LIVE RUN:          npx tsx scripts/fix-positive-reply-flags.ts --execute
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Statuses that indicate a truly positive lead
const POSITIVE_STATUSES = [
  "interested",
  "meeting_booked",
  "meeting_completed",
  "closed",
];

interface Lead {
  id: string;
  email: string;
  campaign_id: string;
  is_positive_reply: boolean;
  has_replied: boolean;
  status: string | null;
}

async function fixPositiveFlags(dryRun: boolean) {
  console.log("=".repeat(60));
  console.log("FIX POSITIVE REPLY FLAGS");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE EXECUTION"}`);
  console.log("");

  // Step 1: Get current counts for comparison
  console.log("[Step 1] Fetching current state...\n");

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: repliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("has_replied", true);

  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  console.log(`  Total leads: ${totalLeads}`);
  console.log(`  has_replied = true: ${repliedCount}`);
  console.log(`  is_positive_reply = true: ${positiveCount}`);
  console.log("");

  // Step 2: Fetch all leads currently marked as positive
  console.log("[Step 2] Fetching leads marked as positive...\n");

  const { data: positiveLeads, error: fetchError } = await supabase
    .from("leads")
    .select("id, email, campaign_id, is_positive_reply, has_replied, status")
    .eq("is_positive_reply", true);

  if (fetchError) {
    console.error("ERROR: Failed to fetch leads:", fetchError);
    process.exit(1);
  }

  console.log(`  Found ${positiveLeads?.length || 0} leads marked as positive\n`);

  if (!positiveLeads || positiveLeads.length === 0) {
    console.log("No leads to process. Exiting.");
    return;
  }

  // Step 3: Analyze which leads should NOT be positive
  console.log("[Step 3] Analyzing leads...\n");

  // Status values that indicate a lead is truly positive (pipeline progression)
  // These statuses indicate the lead showed actual interest or progressed in the pipeline
  const CONFIRMED_POSITIVE_STATUSES = ["booked", "won", "meeting_scheduled", "meeting_completed", "proposal_sent"];

  // Status values that are ambiguous - just "replied" doesn't mean positive
  // These leads need to be reset and re-evaluated by the Instantly API sync
  const AMBIGUOUS_STATUSES = ["replied", "contacted", "new", "opened", "clicked"];

  const leadsToFix: Lead[] = [];
  const leadsCorrectlyPositive: Lead[] = [];
  const statusDistribution: Record<string, number> = {};

  for (const lead of positiveLeads as Lead[]) {
    // Track status distribution
    const statusKey = lead.status || "(null)";
    statusDistribution[statusKey] = (statusDistribution[statusKey] || 0) + 1;

    // Check if this lead should actually be positive based on pipeline status
    // A lead is confirmed positive if:
    // 1. It has a status indicating pipeline progression (booked, won, etc.)
    const hasConfirmedPositiveStatus = lead.status && CONFIRMED_POSITIVE_STATUSES.includes(lead.status);

    if (hasConfirmedPositiveStatus) {
      leadsCorrectlyPositive.push(lead);
    } else {
      // Lead has ambiguous or null status - needs to be re-evaluated
      // The Instantly API should determine if they're truly positive
      leadsToFix.push(lead);
    }
  }

  console.log("  Status distribution of currently positive leads:");
  for (const [status, count] of Object.entries(statusDistribution).sort((a, b) => b[1] - a[1])) {
    const isConfirmedPositive = CONFIRMED_POSITIVE_STATUSES.includes(status);
    console.log(`    ${status}: ${count} ${isConfirmedPositive ? "(confirmed positive)" : "(ambiguous - needs review)"}`);
  }
  console.log("");

  console.log(`  Leads correctly marked as positive: ${leadsCorrectlyPositive.length}`);
  console.log(`  Leads INCORRECTLY marked as positive: ${leadsToFix.length}`);
  console.log("");

  if (leadsToFix.length === 0) {
    console.log("No leads need fixing. All positive leads have valid statuses.");
    return;
  }

  // Step 4: Show sample of leads to be fixed
  console.log("[Step 4] Sample of leads to be fixed (first 10):\n");
  for (const lead of leadsToFix.slice(0, 10)) {
    console.log(`  - ${lead.email}`);
    console.log(`    status: ${lead.status || "(null)"}`);
    console.log(`    has_replied: ${lead.has_replied}`);
    console.log(`    is_positive_reply: ${lead.is_positive_reply} -> will be set to FALSE`);
    console.log("");
  }

  if (leadsToFix.length > 10) {
    console.log(`  ... and ${leadsToFix.length - 10} more\n`);
  }

  // Step 5: Execute fix (or simulate in dry run)
  if (dryRun) {
    console.log("[Step 5] DRY RUN - No changes made\n");
    console.log("  To execute the fix, run:");
    console.log("  npx tsx scripts/fix-positive-reply-flags.ts --execute\n");
  } else {
    console.log("[Step 5] Executing fix...\n");

    const leadIds = leadsToFix.map((l) => l.id);
    const batchSize = 100;
    let fixedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leadIds.length; i += batchSize) {
      const batch = leadIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(leadIds.length / batchSize);

      try {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ is_positive_reply: false })
          .in("id", batch);

        if (updateError) {
          console.error(`  ERROR in batch ${batchNum}/${totalBatches}:`, updateError);
          errorCount += batch.length;
        } else {
          fixedCount += batch.length;
          console.log(`  Fixed batch ${batchNum}/${totalBatches}: ${fixedCount}/${leadIds.length} leads`);
        }
      } catch (err) {
        console.error(`  EXCEPTION in batch ${batchNum}/${totalBatches}:`, err);
        errorCount += batch.length;
      }
    }

    console.log("");
    console.log(`  Successfully fixed: ${fixedCount} leads`);
    if (errorCount > 0) {
      console.log(`  Errors: ${errorCount} leads`);
    }
  }

  // Step 6: Verify results
  console.log("\n[Step 6] Verification...\n");

  const { count: newPositiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  const { count: newRepliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("has_replied", true);

  console.log("  Before fix:");
  console.log(`    is_positive_reply = true: ${positiveCount}`);
  console.log(`    has_replied = true: ${repliedCount}`);
  console.log("");
  console.log("  After fix:");
  console.log(`    is_positive_reply = true: ${newPositiveCount}`);
  console.log(`    has_replied = true: ${newRepliedCount}`);
  console.log("");

  if (dryRun) {
    console.log("  (Expected after live run):");
    console.log(`    is_positive_reply = true: ${leadsCorrectlyPositive.length}`);
  } else {
    const diff = (positiveCount || 0) - (newPositiveCount || 0);
    console.log(`  Fixed ${diff} leads (removed incorrect is_positive_reply flag)`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("COMPLETE");
  console.log("=".repeat(60));
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveRun = args.includes("--execute") || args.includes("--live") || args.includes("-x");

fixPositiveFlags(!isLiveRun).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
