// Mark all replied leads as positive
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Mark all leads that have has_replied=true as is_positive_reply=true
  console.log("Updating leads with has_replied=true to is_positive_reply=true...");

  const { data, error } = await supabase
    .from("leads")
    .update({ is_positive_reply: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("has_replied", true)
    .select("id");

  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Updated ${data?.length || 0} leads to is_positive_reply=true`);
  }

  // Final count
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("is_positive_reply", true);

  console.log(`Final is_positive_reply=true count: ${count}`);
}

main().catch(console.error);
