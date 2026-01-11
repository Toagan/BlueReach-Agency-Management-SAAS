// Check database columns for lead_emails
// Run: node scripts/check-db-columns.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Try inserting and reading back to verify columns work
  const testRecord = {
    lead_id: '00000000-0000-0000-0000-000000000000', // Fake ID
    campaign_id: '00000000-0000-0000-0000-000000000000',
    provider_email_id: `test-${Date.now()}`,
    direction: 'outbound',
    from_email: 'test@test.com',
    to_email: 'lead@test.com',
    subject: 'Test',
    sequence_step: 1,
    sequence_variant: 2,
    sequence_variant_label: 'C',
  };

  console.log('Testing insert with variant data...');
  console.log('Record to insert:', testRecord);

  const { data, error } = await supabase
    .from('lead_emails')
    .insert(testRecord)
    .select('sequence_step, sequence_variant, sequence_variant_label');

  if (error) {
    console.log('\nInsert error (expected - fake IDs):', error.message);

    // Check if columns exist by selecting
    console.log('\nChecking column names by selecting...');
    const { data: sample, error: selectError } = await supabase
      .from('lead_emails')
      .select('sequence_step, sequence_variant, sequence_variant_label')
      .limit(1);

    if (selectError) {
      console.log('Select error:', selectError.message);
    } else {
      console.log('Columns exist! Sample data:', sample);
    }
  } else {
    console.log('\nInserted successfully:', data);
    // Clean up test record
    await supabase.from('lead_emails').delete().eq('provider_email_id', testRecord.provider_email_id);
  }

  // Direct check - get a record with variant and check its values
  console.log('\n--- Check actual data type ---');
  const { data: webhookCheck } = await supabase
    .from('webhook_logs')
    .select('payload')
    .eq('event_type', 'email_sent')
    .limit(1)
    .single();

  if (webhookCheck) {
    console.log('Webhook variant type:', typeof webhookCheck.payload.variant);
    console.log('Webhook variant value:', webhookCheck.payload.variant);
  }
}

main().catch(console.error);
