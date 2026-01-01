import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get Almaron client
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', '%almaron%')
    .single();

  // Get linked campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, instantly_campaign_id')
    .eq('client_id', client.id);

  console.log('Linked campaigns:');
  campaigns.forEach(c => console.log('  -', c.name, '(', c.id, ')'));

  // Get positive leads grouped by campaign
  const { data: leads } = await supabase
    .from('leads')
    .select('campaign_id, campaign_name, status, is_positive_reply')
    .eq('client_id', client.id)
    .eq('is_positive_reply', true);

  console.log('\nPositive leads by campaign_id:');
  const byCampaignId = {};
  leads.forEach(l => {
    const key = l.campaign_id || 'no_campaign_id';
    if (!byCampaignId[key]) byCampaignId[key] = { count: 0, statuses: {} };
    byCampaignId[key].count++;
    byCampaignId[key].statuses[l.status] = (byCampaignId[key].statuses[l.status] || 0) + 1;
  });

  const linkedIds = campaigns.map(c => c.id);

  Object.entries(byCampaignId).forEach(([id, data]) => {
    const campaign = campaigns.find(c => c.id === id);
    const isLinked = linkedIds.includes(id);
    console.log('  Campaign:', campaign ? campaign.name : id, isLinked ? '' : '(NOT LINKED)');
    console.log('    Count:', data.count);
    console.log('    Statuses:', data.statuses);
  });

  console.log('\nTotal positive leads:', leads.length);
}

check();
