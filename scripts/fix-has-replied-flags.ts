/**
 * Fix has_replied Flags
 *
 * This script repairs leads where email_reply_count > 0 but has_replied is not set.
 * The bug was that the provider sync wasn't mapping email_reply_count, so has_replied
 * was only being set for positive leads, not ALL leads who replied.
 *
 * Usage:
 *   DRY RUN (default): npx tsx scripts/fix-has-replied-flags.ts
 *   LIVE RUN:          npx tsx scripts/fix-has-replied-flags.ts --execute
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixHasRepliedFlags(dryRun: boolean) {
  console.log("=".repeat(60));
  console.log("FIX HAS_REPLIED FLAGS");
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

  const { count: replyCountPositive } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gt("email_reply_count", 0);

  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  console.log(`  Total leads: ${totalLeads}`);
  console.log(`  has_replied = true: ${hasRepliedCount}`);
  console.log(`  email_reply_count > 0: ${replyCountPositive}`);
  console.log(`  is_positive_reply = true: ${positiveCount}`);
  console.log("");

  // Step 2: Find leads that need fixing
  console.log("[Step 2] Finding leads with email_reply_count > 0 but has_replied != true...\n");

  const { data: leadsToFix, error: fetchError } = await supabase
    .from("leads")
    .select("id, email, campaign_id, email_reply_count, has_replied, is_positive_reply, status")
    .gt("email_reply_count", 0)
    .or("has_replied.is.null,has_replied.eq.false");

  if (fetchError) {
    console.error("ERROR: Failed to fetch leads:", fetchError);
    process.exit(1);
  }

  console.log(`  Found ${leadsToFix?.length || 0} leads that need fixing\n`);

  if (!leadsToFix || leadsToFix.length === 0) {
    console.log("No leads need fixing. All leads with replies have has_replied = true.");
    return;
  }

  // Step 3: Show sample
  console.log("[Step 3] Sample of leads to be fixed (first 10):\n");
  for (const lead of leadsToFix.slice(0, 10)) {
    console.log(`  - ${lead.email}`);
    console.log(`    email_reply_count: ${lead.email_reply_count}`);
    console.log(`    has_replied: ${lead.has_replied} -> will be set to TRUE`);
    console.log(`    is_positive_reply: ${lead.is_positive_reply}`);
    console.log(`    status: ${lead.status}`);
    console.log("");
  }

  if (leadsToFix.length > 10) {
    console.log(`  ... and ${leadsToFix.length - 10} more\n`);
  }

  // Step 4: Execute fix
  if (dryRun) {
    console.log("[Step 4] DRY RUN - No changes made\n");
    console.log("  To execute the fix, run:");
    console.log("  npx tsx scripts/fix-has-replied-flags.ts --execute\n");
  } else {
    console.log("[Step 4] Executing fix...\n");

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
          .update({ has_replied: true })
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

  // Step 5: Verify
  console.log("\n[Step 5] Verification...\n");

  const { count: newHasRepliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("has_replied", true);

  const { count: newReplyCountPositive } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gt("email_reply_count", 0);

  console.log("  Before fix:");
  console.log(`    has_replied = true: ${hasRepliedCount}`);
  console.log(`    email_reply_count > 0: ${replyCountPositive}`);
  console.log("");
  console.log("  After fix:");
  console.log(`    has_replied = true: ${newHasRepliedCount}`);
  console.log(`    email_reply_count > 0: ${newReplyCountPositive}`);
  console.log("");

  if (dryRun) {
    console.log("  (Expected after live run):");
    console.log(`    has_replied = true: ${replyCountPositive}`);
    console.log(`    (Should match email_reply_count > 0)`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("COMPLETE");
  console.log("=".repeat(60));
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveRun = args.includes("--execute") || args.includes("--live") || args.includes("-x");

fixHasRepliedFlags(!isLiveRun).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
