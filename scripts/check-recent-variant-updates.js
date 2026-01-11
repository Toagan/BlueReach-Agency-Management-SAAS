// Check for recent leads with variant updates
// Run: node scripts/check-recent-variant-updates.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Checking for leads with variant data...\n');

  // Check leads table for any variant data
  const { data: leadsWithVariant, error: leadError } = await supabase
    .from('leads')
    .select('id, email, campaign_id, reply_from_step, reply_from_variant, reply_from_variant_label, updated_at')
    .not('reply_from_step', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (leadError) {
    console.error('Error:', leadError);
    return;
  }

  console.log(`Leads with reply_from_step: ${leadsWithVariant.length}`);

  if (leadsWithVariant.length > 0) {
    console.log('\nRecent leads with variant tracking:');
    for (const lead of leadsWithVariant.slice(0, 10)) {
      console.log(`  ${lead.email}: Step ${lead.reply_from_step}, Variant ${lead.reply_from_variant_label || lead.reply_from_variant}`);
    }
  }

  // Check lead_emails table
  const { data: emailsWithVariant, error: emailError } = await supabase
    .from('lead_emails')
    .select('id, from_email, to_email, sequence_step, sequence_variant, sequence_variant_label, created_at')
    .not('sequence_variant', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (emailError) {
    console.error('Email error:', emailError);
  } else {
    console.log(`\nEmails with sequence_variant: ${emailsWithVariant.length}`);

    if (emailsWithVariant.length > 0) {
      console.log('\nRecent emails with variant tracking:');
      for (const email of emailsWithVariant.slice(0, 10)) {
        console.log(`  ${email.to_email}: Step ${email.sequence_step}, Variant ${email.sequence_variant_label || email.sequence_variant}`);
      }
    }
  }

  // Check recent webhook logs that should have triggered updates
  console.log('\n--- Checking recent webhook events ---');
  const { data: recentWebhooks, error: whError } = await supabase
    .from('webhook_logs')
    .select('event_type, lead_email, payload, created_at')
    .in('event_type', ['email_sent', 'reply_received', 'lead_interested', 'lead_not_interested'])
    .not('payload->step', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (whError) {
    console.error('Webhook error:', whError);
  } else {
    console.log(`Recent webhooks with step data: ${recentWebhooks.length}`);

    for (const wh of recentWebhooks.slice(0, 5)) {
      console.log(`\n  Event: ${wh.event_type}`);
      console.log(`  Email: ${wh.lead_email}`);
      console.log(`  Step: ${wh.payload.step}, Variant: ${wh.payload.variant}`);
      console.log(`  Time: ${wh.created_at}`);
    }
  }
}

main().catch(console.error);
