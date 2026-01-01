import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Count total leads
  const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true });

  // Count positive replies
  const { count: positiveReplies } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('is_positive_reply', true);

  // Get status breakdown manually
  const statuses = ['contacted', 'replied', 'booked', 'won', 'not_interested'];
  const statusBreakdown = {};
  for (const status of statuses) {
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', status);
    statusBreakdown[status] = count;
  }

  // Count campaigns
  const { count: totalCampaigns } = await supabase.from('campaigns').select('*', { count: 'exact', head: true });

  // Get campaigns with instantly_campaign_id
  const { data: campaigns } = await supabase.from('campaigns').select('id, name, instantly_campaign_id, client_id');

  // Get leads with email_reply_count > 0
  const { count: leadsWithReplies } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gt('email_reply_count', 0);

  console.log('=== Database Stats ===');
  console.log('Total Leads:', totalLeads);
  console.log('Positive Replies (is_positive_reply=true):', positiveReplies);
  console.log('Leads with email_reply_count > 0:', leadsWithReplies);
  console.log('\nStatus Breakdown:');
  console.log(statusBreakdown);
  console.log('\nTotal Campaigns:', totalCampaigns);
  console.log('\nCampaigns:');
  if (campaigns) {
    campaigns.forEach(function(c) {
      console.log('  - ' + c.name + ' (instantly_id: ' + (c.instantly_campaign_id || 'none') + ')');
    });
  }
}

check().catch(console.error);
