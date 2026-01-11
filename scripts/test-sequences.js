require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, provider_type, provider_campaign_id, api_key_encrypted')
    .eq('id', 'ef7ec304-406f-49f6-8556-1a51ccd199a7')
    .single();
    
  console.log('Campaign:', campaign?.name);
  console.log('Provider:', campaign?.provider_type);
  console.log('Provider Campaign ID:', campaign?.provider_campaign_id);
  console.log('Has API Key:', Boolean(campaign?.api_key_encrypted));
  
  if (campaign?.api_key_encrypted && campaign?.provider_campaign_id) {
    const baseUrl = 'https://server.smartlead.ai/api/v1';
    const res = await fetch(baseUrl + '/campaigns/' + campaign.provider_campaign_id + '/sequences?api_key=' + campaign.api_key_encrypted);
    const data = await res.json();
    
    console.log('\nSmartlead Response Type:', typeof data);
    console.log('Is Array:', Array.isArray(data));
    if (typeof data === 'object') {
      console.log('Keys:', Object.keys(data));
    }
    
    const steps = Array.isArray(data) ? data : data.email_campaign_sequences || [];
    console.log('\nSteps found:', steps.length);
    
    if (steps.length > 0) {
      console.log('\nFirst step keys:', Object.keys(steps[0]));
      const variants = steps[0].sequence_variants || steps[0].seq_variants || [];
      console.log('First step variants:', variants.length);
      if (variants.length > 0) {
        console.log('First variant keys:', Object.keys(variants[0]));
        console.log('First variant label:', variants[0].variant_label);
        console.log('Has email_body:', Boolean(variants[0].email_body));
        if (variants[0].email_body) {
          console.log('Body preview:', variants[0].email_body.substring(0, 100));
        }
      }
    }
  }
}

test().catch(console.error);
