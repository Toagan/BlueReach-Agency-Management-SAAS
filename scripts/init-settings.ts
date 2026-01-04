/**
 * Initialize database settings from environment variables
 *
 * Usage: npx tsx scripts/init-settings.ts
 *
 * This script upserts settings from .env.local into the Supabase settings table.
 * It's idempotent - safe to run multiple times.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

// Mask sensitive values for logging
function maskValue(value: string, showChars = 6): string {
  if (value.length <= showChars * 2) return "***";
  return `${value.substring(0, showChars)}...${value.substring(value.length - 3)}`;
}

interface SettingConfig {
  key: string;
  envVar: string;
  sensitive?: boolean;
  defaultValue?: string;
}

const settingsToInit: SettingConfig[] = [
  { key: "resend_api_key", envVar: "RESEND_API_KEY", sensitive: true },
  { key: "agency_name", envVar: "AGENCY_NAME", defaultValue: "BlueReach" },
  { key: "agency_sender_name", envVar: "AGENCY_SENDER_NAME", defaultValue: "BlueReach Team" },
  { key: "agency_sender_email", envVar: "AGENCY_SENDER_EMAIL", defaultValue: "noreply@bluereach.com" },
  { key: "agency_primary_color", envVar: "AGENCY_PRIMARY_COLOR", defaultValue: "#2563eb" },
];

async function initSettings() {
  console.log("Initializing database settings...\n");

  // First, check if settings table exists
  const { error: tableCheckError } = await supabase
    .from("settings")
    .select("key")
    .limit(1);

  if (tableCheckError?.code === "42P01") {
    console.error("Error: 'settings' table does not exist.");
    console.log("\nCreate it with this SQL:");
    console.log(`
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);
    `);
    process.exit(1);
  }

  let successCount = 0;
  let skipCount = 0;

  for (const setting of settingsToInit) {
    const value = process.env[setting.envVar] || setting.defaultValue;

    if (!value) {
      console.log(`  SKIP: ${setting.key} - No value in ${setting.envVar} env var`);
      skipCount++;
      continue;
    }

    // Upsert the setting
    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: setting.key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      console.error(`  ERROR: ${setting.key} - ${error.message}`);
    } else {
      const displayValue = setting.sensitive ? maskValue(value) : value;
      console.log(`  OK: ${setting.key} = ${displayValue}`);
      successCount++;
    }
  }

  console.log(`\nDone! ${successCount} settings initialized, ${skipCount} skipped.`);
}

initSettings().catch(console.error);
