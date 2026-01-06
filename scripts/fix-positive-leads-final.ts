/**
 * Final Fix for Positive Leads
 *
 * 1. Fetch all leads from Instantly
 * 2. Identify leads with lt_interest_status = 1 (positive)
 * 3. Update Supabase: is_positive_reply = true for positive, false for others
 * 4. Clean up salutations from first_name field
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const PROVIDER_CAMPAIGN_ID = "01c2efd7-8db4-4d39-8dab-e85a40a77e1c";

// Salutations to remove from first_name
const SALUTATIONS_TO_REMOVE = [
  // German formal
  "Sehr geehrter Herr",
  "Sehr geehrte Frau",
  "Sehr geehrte Damen und Herren",
  "Sehr geehrter",
  "Sehr geehrte",
  // German informal
  "Lieber Herr",
  "Liebe Frau",
  "Lieber",
  "Liebe",
  "Hallo Herr",
  "Hallo Frau",
  "Hallo",
  "Hi Herr",
  "Hi Frau",
  "Hi",
  "Guten Tag Herr",
  "Guten Tag Frau",
  "Guten Tag",
  // English
  "Dear Mr.",
  "Dear Mrs.",
  "Dear Ms.",
  "Dear Mr",
  "Dear Mrs",
  "Dear Ms",
  "Dear",
  "Hello Mr.",
  "Hello Mrs.",
  "Hello Ms.",
  "Hello Mr",
  "Hello Mrs",
  "Hello Ms",
  "Hello",
  "Hi Mr.",
  "Hi Mrs.",
  "Hi Ms.",
  "Hi Mr",
  "Hi Mrs",
  "Hi Ms",
  // Titles
  "Herr",
  "Frau",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Mr",
  "Mrs",
  "Ms",
  "Dr.",
  "Dr",
  "Prof.",
  "Prof",
];

function cleanFirstName(firstName: string | null | undefined): string | null {
  if (!firstName) return null;

  let cleaned = firstName.trim();

  // Sort by length descending to match longer salutations first
  const sortedSalutations = [...SALUTATIONS_TO_REMOVE].sort((a, b) => b.length - a.length);

  for (const salutation of sortedSalutations) {
    // Case-insensitive match at the start
    if (cleaned.toLowerCase().startsWith(salutation.toLowerCase())) {
      cleaned = cleaned.substring(salutation.length).trim();
    }
  }

  // Remove any leading/trailing punctuation and whitespace
  cleaned = cleaned.replace(/^[\s,.:]+|[\s,.:]+$/g, "").trim();

  // If nothing left, return null
  if (!cleaned || cleaned.length === 0) return null;

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return cleaned;
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

  const apiKey = campaign?.api_key_encrypted!;

  console.log("=".repeat(70));
  console.log("STEP 1: Fetching all leads from Instantly");
  console.log("=".repeat(70));

  // Fetch all leads and categorize by lt_interest_status
  const positiveLeads: Array<{ id: string; email: string; first_name?: string }> = [];
  const otherLeads: Array<{ id: string; email: string }> = [];

  let skip = 0;
  const limit = 100;

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

    if (!response.ok) {
      console.error(`API error at skip=${skip}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const leads = data.items || [];

    for (const lead of leads) {
      if (lead.lt_interest_status === 1) {
        positiveLeads.push({
          id: lead.id,
          email: lead.email,
          first_name: lead.first_name,
        });
      } else {
        otherLeads.push({
          id: lead.id,
          email: lead.email,
        });
      }
    }

    if (leads.length < limit) break;
    skip += limit;

    if (skip % 2000 === 0) {
      console.log(`  Processed ${skip} leads...`);
    }
  }

  console.log(`\nFound ${positiveLeads.length} positive leads (lt_interest_status = 1)`);
  console.log(`Found ${otherLeads.length} other leads\n`);

  // Show positive leads
  console.log("Positive leads:");
  positiveLeads.forEach((l, i) => {
    const cleanedName = cleanFirstName(l.first_name);
    console.log(`  ${i + 1}. ${l.email} | "${l.first_name}" → "${cleanedName}"`);
  });

  console.log("\n" + "=".repeat(70));
  console.log("STEP 2: Reset all leads in campaign to is_positive_reply = false");
  console.log("=".repeat(70));

  const { error: resetError, count: resetCount } = await supabase
    .from("leads")
    .update({ is_positive_reply: false })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("is_positive_reply", true)
    .select("id", { count: "exact", head: true });

  if (resetError) {
    console.error("Reset error:", resetError);
  } else {
    console.log(`Reset ${resetCount || 0} leads to is_positive_reply = false`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("STEP 3: Update positive leads with is_positive_reply = true + clean names");
  console.log("=".repeat(70));

  let updatedCount = 0;
  let notFoundCount = 0;
  let namesCleaned = 0;

  for (const lead of positiveLeads) {
    const cleanedFirstName = cleanFirstName(lead.first_name);

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      is_positive_reply: true,
      has_replied: true,
    };

    // Add cleaned name if different from original
    if (cleanedFirstName !== lead.first_name) {
      updatePayload.first_name = cleanedFirstName;
      namesCleaned++;
    }

    // Try update by instantly_lead_id first
    const { data: updated, error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("campaign_id", CAMPAIGN_ID)
      .eq("instantly_lead_id", lead.id)
      .select("id");

    if (error) {
      console.error(`Error updating ${lead.email}:`, error);
      continue;
    }

    if (updated && updated.length > 0) {
      updatedCount++;
    } else {
      // Fallback to email match
      const { data: emailUpdated } = await supabase
        .from("leads")
        .update({
          ...updatePayload,
          instantly_lead_id: lead.id, // Backfill
        })
        .eq("campaign_id", CAMPAIGN_ID)
        .ilike("email", lead.email.toLowerCase().trim())
        .select("id");

      if (emailUpdated && emailUpdated.length > 0) {
        updatedCount++;
      } else {
        notFoundCount++;
        console.log(`  Not found: ${lead.email}`);
      }
    }
  }

  console.log(`\nUpdated ${updatedCount} leads to is_positive_reply = true`);
  console.log(`Cleaned ${namesCleaned} first names`);
  console.log(`Not found in Supabase: ${notFoundCount}`);

  console.log("\n" + "=".repeat(70));
  console.log("STEP 4: Verify final counts");
  console.log("=".repeat(70));

  const { count: finalPositiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("is_positive_reply", true);

  const { count: totalLeadsCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID);

  console.log(`\nFinal Results:`);
  console.log(`  Total leads in campaign: ${totalLeadsCount}`);
  console.log(`  is_positive_reply = true: ${finalPositiveCount}`);
  console.log(`  Expected: 54`);

  if (finalPositiveCount === 54) {
    console.log(`\n✅ SUCCESS! Count matches expected 54 positive leads.`);
  } else {
    console.log(`\n⚠️  Count is ${finalPositiveCount}, expected 54. Difference: ${(finalPositiveCount || 0) - 54}`);
  }
}

main().catch(console.error);
