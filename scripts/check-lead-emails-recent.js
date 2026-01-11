// Check recent lead_emails records
// Run: node scripts/check-lead-emails-recent.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get most recent lead_emails
  const { data: emails, error } = await supabase
    .from('lead_emails')
    .select('id, to_email, direction, sequence_step, sequence_variant, sequence_variant_label, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Most recent ${emails.length} lead_emails:\n`);

  for (const email of emails) {
    console.log(`${email.created_at} | ${email.direction} | ${email.to_email}`);
    console.log(`  Step: ${email.sequence_step}, Variant: ${email.sequence_variant}, Label: ${email.sequence_variant_label}`);
  }

  // Count by campaign
  console.log('\n--- Total by direction ---');
  const { data: counts } = await supabase
    .from('lead_emails')
    .select('direction')
    .limit(10000);

  const outbound = counts?.filter(e => e.direction === 'outbound').length || 0;
  const inbound = counts?.filter(e => e.direction === 'inbound').length || 0;
  console.log(`Outbound: ${outbound}, Inbound: ${inbound}`);
}

main().catch(console.error);
