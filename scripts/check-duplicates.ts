// Check for duplicate leads in Supabase
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("=== LEAD COUNT ANALYSIS ===");
  console.log("Known from Instantly API: 18,096 leads");

  // Count leads in Supabase
  const { count: supabaseCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID);

  console.log("Supabase leads:", supabaseCount);
  console.log("Difference:", (supabaseCount || 0) - 18096);
  console.log("Ratio:", ((supabaseCount || 0) / 18096).toFixed(2) + "x");

  // Check for duplicates by paginating through all leads
  console.log("\n=== CHECKING FOR DUPLICATE EMAILS ===");
  const emailCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  let offset = 0;
  const batchSize = 1000;
  let totalProcessed = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from("leads")
      .select("email, instantly_lead_id")
      .eq("campaign_id", CAMPAIGN_ID)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("Error:", error);
      break;
    }

    if (!batch || batch.length === 0) break;

    for (const lead of batch) {
      const email = lead.email?.toLowerCase();
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
      if (lead.instantly_lead_id) {
        idCounts.set(lead.instantly_lead_id, (idCounts.get(lead.instantly_lead_id) || 0) + 1);
      }
    }

    totalProcessed += batch.length;
    if (batch.length < batchSize) break;
    offset += batchSize;

    if (offset % 10000 === 0) {
      console.log(`  Processed ${offset} leads...`);
    }
  }

  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Unique emails: ${emailCounts.size}`);
  console.log(`Unique instantly_lead_ids: ${idCounts.size}`);

  // Count duplicates
  let emailDuplicates = 0;
  let idDuplicates = 0;
  const sampleEmailDups: string[] = [];
  const sampleIdDups: string[] = [];

  for (const [email, count] of emailCounts) {
    if (count > 1) {
      emailDuplicates += count - 1;
      if (sampleEmailDups.length < 5) {
        sampleEmailDups.push(`${email}: ${count}x`);
      }
    }
  }

  for (const [id, count] of idCounts) {
    if (count > 1) {
      idDuplicates += count - 1;
      if (sampleIdDups.length < 5) {
        sampleIdDups.push(`${id}: ${count}x`);
      }
    }
  }

  console.log(`\nDuplicate email entries: ${emailDuplicates}`);
  console.log(`Duplicate instantly_lead_id entries: ${idDuplicates}`);

  if (sampleEmailDups.length > 0) {
    console.log("\nSample duplicate emails:");
    sampleEmailDups.forEach(s => console.log(`  ${s}`));
  }

  if (sampleIdDups.length > 0) {
    console.log("\nSample duplicate instantly_lead_ids:");
    sampleIdDups.forEach(s => console.log(`  ${s}`));
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Expected (from Instantly): 18,096`);
  console.log(`Actual (in Supabase): ${supabaseCount}`);
  console.log(`Unique emails: ${emailCounts.size}`);
  console.log(`Extra rows due to duplicates: ${emailDuplicates}`);

  if (emailDuplicates > 0) {
    console.log("\nROOT CAUSE: Duplicate lead records exist in the database.");
    console.log("The sync process created multiple entries for the same email.");
  } else if ((supabaseCount || 0) > 18096) {
    console.log("\nROOT CAUSE: More leads in Supabase than in Instantly.");
    console.log("This could be due to:");
    console.log("  - Multiple sync runs importing the same leads");
    console.log("  - Leads imported from a different source");
    console.log("  - Leads from deleted/archived campaigns");
  }
}

main().catch(console.error);
