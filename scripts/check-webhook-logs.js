// Check webhook logs for step/variant data
// Run: node scripts/check-webhook-logs.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Checking webhook logs for step/variant data...\n');

  // Get recent webhook logs with step/variant data
  const { data: logs, error } = await supabase
    .from('webhook_logs')
    .select('id, event_type, lead_email, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${logs.length} recent webhook logs\n`);

  let withStep = 0;
  let withVariant = 0;

  for (const log of logs) {
    const payload = log.payload;
    if (payload.step !== undefined) withStep++;
    if (payload.variant !== undefined) withVariant++;
  }

  console.log(`Logs with step data: ${withStep}`);
  console.log(`Logs with variant data: ${withVariant}`);

  // Show sample payloads
  console.log('\n--- Sample Payloads with Step/Variant ---');
  const samplesWithData = logs.filter(l => l.payload.step !== undefined || l.payload.variant !== undefined).slice(0, 3);

  if (samplesWithData.length === 0) {
    console.log('No webhooks with step/variant data found');

    // Show some sample payloads anyway
    console.log('\n--- Recent Webhook Payloads (keys only) ---');
    for (const log of logs.slice(0, 5)) {
      console.log(`\nEvent: ${log.event_type}`);
      console.log(`Keys: ${Object.keys(log.payload).join(', ')}`);
    }
  } else {
    for (const log of samplesWithData) {
      console.log(`\nEvent: ${log.event_type}, Email: ${log.lead_email}`);
      console.log(`Step: ${log.payload.step}, Variant: ${log.payload.variant}`);
    }
  }
}

main().catch(console.error);
