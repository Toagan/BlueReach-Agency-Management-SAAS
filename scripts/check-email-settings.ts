import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["resend_api_key", "agency_name", "agency_sender_email", "agency_sender_name"]);

  if (error) {
    console.log("Error or table does not exist:", error.message);
    return;
  }

  console.log("Email settings in database:");
  for (const s of data || []) {
    if (s.key === "resend_api_key") {
      console.log(`  ${s.key}: ${s.value ? "CONFIGURED (" + s.value.substring(0, 8) + "...)" : "NOT SET"}`);
    } else {
      console.log(`  ${s.key}: ${s.value || "NOT SET"}`);
    }
  }

  if (!data?.length) {
    console.log("  No email settings found in database");
  }
}

check();
