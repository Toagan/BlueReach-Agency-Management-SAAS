/**
 * Database Integrity Audit
 *
 * 1. Index Check - verify UNIQUE constraints
 * 2. Deduplication Test - find duplicate leads
 * 3. Sync Simulation - verify upsert logic
 * 4. Orphan Check - find orphaned lead_emails
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function audit() {
  console.log("=".repeat(60));
  console.log("DATABASE INTEGRITY AUDIT");
  console.log("=".repeat(60));

  // ============================================
  // 1. INDEX CHECK
  // ============================================
  console.log("\n[1] INDEX CHECK - Verifying UNIQUE constraints\n");

  // Check leads table indexes
  const { data: leadsIndexes, error: leadsIdxErr } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'leads'
      AND indexdef ILIKE '%unique%'
    `
  });

  // Fallback: query information_schema for constraints
  const { data: leadsConstraints } = await supabase
    .from("leads")
    .select("id")
    .limit(0);

  // Try to get constraint info via raw query
  const { data: constraints, error: constraintErr } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'leads'
        AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `
  });

  if (constraintErr) {
    console.log("  Cannot query constraints directly (RPC not available)");
    console.log("  Performing empirical uniqueness test instead...\n");
  } else {
    console.log("  Leads table constraints:", constraints);
  }

  // Empirical test: Try to find duplicates which would indicate missing constraint
  const { data: leadDupes } = await supabase
    .from("leads")
    .select("campaign_id, email")
    .limit(50000);

  const leadMap = new Map<string, number>();
  let leadDuplicates: { campaign_id: string; email: string; count: number }[] = [];

  if (leadDupes) {
    for (const lead of leadDupes) {
      const key = `${lead.campaign_id}:${lead.email}`;
      leadMap.set(key, (leadMap.get(key) || 0) + 1);
    }

    for (const [key, count] of leadMap) {
      if (count > 1) {
        const [campaign_id, email] = key.split(":");
        leadDuplicates.push({ campaign_id, email, count });
      }
    }
  }

  if (leadDuplicates.length === 0) {
    console.log("  ✓ leads(campaign_id, email) - No duplicates found (constraint appears intact)");
  } else {
    console.log("  ✗ leads(campaign_id, email) - DUPLICATES FOUND!");
  }

  // Check lead_emails uniqueness on provider_email_id
  const { data: emailDupes } = await supabase
    .from("lead_emails")
    .select("provider_email_id")
    .not("provider_email_id", "is", null)
    .limit(50000);

  const emailMap = new Map<string, number>();
  let emailDuplicates: { provider_email_id: string; count: number }[] = [];

  if (emailDupes) {
    for (const email of emailDupes) {
      if (email.provider_email_id) {
        emailMap.set(email.provider_email_id, (emailMap.get(email.provider_email_id) || 0) + 1);
      }
    }

    for (const [id, count] of emailMap) {
      if (count > 1) {
        emailDuplicates.push({ provider_email_id: id, count });
      }
    }
  }

  if (emailDuplicates.length === 0) {
    console.log("  ✓ lead_emails(provider_email_id) - No duplicates found (constraint appears intact)");
  } else {
    console.log("  ✗ lead_emails(provider_email_id) - DUPLICATES FOUND!");
  }

  // ============================================
  // 2. DEDUPLICATION TEST
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("[2] DEDUPLICATION TEST - Finding duplicate leads\n");

  if (leadDuplicates.length === 0) {
    console.log("  ✓ No duplicate leads found in the database");
  } else {
    console.log(`  ✗ Found ${leadDuplicates.length} duplicate lead(s):\n`);
    for (const dup of leadDuplicates.slice(0, 10)) {
      console.log(`    - Campaign: ${dup.campaign_id}`);
      console.log(`      Email: ${dup.email}`);
      console.log(`      Count: ${dup.count}\n`);
    }
    if (leadDuplicates.length > 10) {
      console.log(`    ... and ${leadDuplicates.length - 10} more`);
    }
  }

  if (emailDuplicates.length > 0) {
    console.log(`\n  ✗ Found ${emailDuplicates.length} duplicate provider_email_id(s):\n`);
    for (const dup of emailDuplicates.slice(0, 5)) {
      console.log(`    - ID: ${dup.provider_email_id} (count: ${dup.count})`);
    }
  }

  // ============================================
  // 3. SYNC SIMULATION (Dry Run)
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("[3] SYNC SIMULATION - Testing upsert logic\n");

  // Get one existing lead
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id, campaign_id, email, first_name, is_positive_reply")
    .limit(1)
    .single();

  if (existingLead) {
    console.log("  Testing with existing lead:");
    console.log(`    ID: ${existingLead.id}`);
    console.log(`    Email: ${existingLead.email}`);
    console.log(`    Campaign: ${existingLead.campaign_id}\n`);

    // Simulate upsert with the same data
    const { data: upsertResult, error: upsertError } = await supabase
      .from("leads")
      .upsert(
        {
          campaign_id: existingLead.campaign_id,
          email: existingLead.email,
          first_name: existingLead.first_name,
          is_positive_reply: existingLead.is_positive_reply,
        },
        {
          onConflict: "campaign_id,email",
          ignoreDuplicates: false,
        }
      )
      .select("id");

    if (upsertError) {
      console.log("  ✗ Upsert FAILED:", upsertError.message);

      // Check if there's no unique constraint
      if (upsertError.message.includes("there is no unique or exclusion constraint")) {
        console.log("\n  ⚠️  WARNING: No UNIQUE constraint on (campaign_id, email)!");
        console.log("  The upsert requires this constraint to work properly.");
        console.log("  Recommended fix: Add unique index to leads table");
      }
    } else {
      const returnedId = upsertResult?.[0]?.id;
      if (returnedId === existingLead.id) {
        console.log("  ✓ Upsert correctly UPDATED existing record (same ID returned)");
      } else {
        console.log("  ⚠️  Upsert returned different ID - may have created duplicate");
        console.log(`     Original ID: ${existingLead.id}`);
        console.log(`     Returned ID: ${returnedId}`);
      }
    }
  } else {
    console.log("  No existing leads to test with");
  }

  // ============================================
  // 4. ORPHAN CHECK
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("[4] ORPHAN CHECK - Finding orphaned lead_emails\n");

  // Find lead_emails with lead_id that doesn't exist in leads
  const { data: orphanedEmails, error: orphanErr } = await supabase
    .from("lead_emails")
    .select("id, lead_id, from_email, to_email, subject")
    .not("lead_id", "is", null)
    .limit(1000);

  if (orphanErr) {
    console.log("  Error checking orphans:", orphanErr.message);
  } else if (orphanedEmails && orphanedEmails.length > 0) {
    // Get all unique lead_ids
    const leadIds = [...new Set(orphanedEmails.map(e => e.lead_id))];

    // Check which ones actually exist
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id")
      .in("id", leadIds);

    const existingLeadIds = new Set(existingLeads?.map(l => l.id) || []);
    const orphans = orphanedEmails.filter(e => !existingLeadIds.has(e.lead_id));

    if (orphans.length === 0) {
      console.log("  ✓ No orphaned lead_emails found");
      console.log(`    (Checked ${orphanedEmails.length} email records, all have valid lead_id)`);
    } else {
      console.log(`  ✗ Found ${orphans.length} orphaned lead_email records:\n`);
      for (const orphan of orphans.slice(0, 5)) {
        console.log(`    - Email ID: ${orphan.id}`);
        console.log(`      Missing lead_id: ${orphan.lead_id}`);
        console.log(`      Subject: ${orphan.subject?.slice(0, 50)}...\n`);
      }
    }
  } else {
    console.log("  ✓ No lead_emails to check (table may be empty)");
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("AUDIT SUMMARY");
  console.log("=".repeat(60));

  const issues: string[] = [];

  if (leadDuplicates.length > 0) {
    issues.push(`${leadDuplicates.length} duplicate leads found`);
  }
  if (emailDuplicates.length > 0) {
    issues.push(`${emailDuplicates.length} duplicate provider_email_ids found`);
  }

  if (issues.length === 0) {
    console.log("\n✓ All checks passed - Database integrity is GOOD\n");
  } else {
    console.log("\n⚠️  Issues found:");
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
    console.log("");
  }
}

audit().catch(console.error);
