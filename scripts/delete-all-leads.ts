// Delete all leads from the campaign to prepare for fresh sync
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Count before
  const { count: beforeCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID);

  console.log("=== DELETING ALL LEADS ===");
  console.log("Campaign ID:", CAMPAIGN_ID);
  console.log("Leads before deletion:", beforeCount);

  if (beforeCount === 0) {
    console.log("No leads to delete.");
    return;
  }

  console.log("\nDeleting leads in batches...");

  // Delete directly by campaign_id
  let totalDeleted = 0;
  const batchSize = 1000;

  while (true) {
    // Delete a batch - Supabase limits delete to avoid timeouts
    const { data: deleted, error: deleteError } = await supabase
      .from("leads")
      .delete()
      .eq("campaign_id", CAMPAIGN_ID)
      .select("id")
      .limit(batchSize);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      break;
    }

    if (!deleted || deleted.length === 0) {
      break;
    }

    totalDeleted += deleted.length;
    console.log(`  Deleted ${totalDeleted} leads...`);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Count after
  const { count: afterCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID);

  console.log("\n=== RESULT ===");
  console.log("Leads after deletion:", afterCount);
  console.log("Total deleted:", totalDeleted);

  if (afterCount === 0) {
    console.log("\n✅ All leads deleted successfully!");
    console.log("You can now re-sync leads from Instantly.");
  }
}

main().catch(console.error);
