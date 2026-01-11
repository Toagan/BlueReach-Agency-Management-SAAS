// Check email_sent webhook payloads
// Run: node scripts/check-email-sent-payloads.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: logs, error } = await supabase
    .from('webhook_logs')
    .select('payload')
    .eq('event_type', 'email_sent')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('email_sent webhook payload fields:\n');

  for (const log of logs) {
    console.log('Fields:', Object.keys(log.payload).join(', '));
    console.log('Has email_subject:', !!log.payload.email_subject);
    console.log('Has email_text:', !!log.payload.email_text);
    console.log('Has email_html:', !!log.payload.email_html);
    console.log('step:', log.payload.step);
    console.log('variant:', log.payload.variant);
    console.log('---');
  }
}

main().catch(console.error);
