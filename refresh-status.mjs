import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const BASE_URL = 'https://api.instantly.ai/api/v2';

async function fetchLeadsBatch(campaignId, skip, limit) {
  const response = await fetch(BASE_URL + '/leads/list', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + INSTANTLY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaign_id: campaignId,
      limit,
      skip,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leads: ' + response.status);
  }

  const data = await response.json();
  return data.items || data || [];
}

async function refreshStatus() {
  console.log('Starting status refresh...\n');

  // Get all campaigns with instantly_campaign_id
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, instantly_campaign_id')
    .not('instantly_campaign_id', 'is', null);

  if (error) {
    console.error('Failed to fetch campaigns:', error.message);
    return;
  }

  console.log('Found ' + campaigns.length + ' campaigns to process\n');

  let totalUpdated = 0;
  let totalNotFound = 0;

  for (const campaign of campaigns) {
    console.log('Processing: ' + campaign.name);
    console.log('  Instantly ID: ' + campaign.instantly_campaign_id);

    let skip = 0;
    const limit = 100;
    let campaignUpdated = 0;
    let campaignNotFound = 0;
    let batchNum = 0;

    while (true) {
      batchNum++;
      process.stdout.write('  Batch ' + batchNum + ': fetching...');

      let leads;
      try {
        leads = await fetchLeadsBatch(campaign.instantly_campaign_id, skip, limit);
      } catch (err) {
        console.log(' ERROR: ' + err.message);
        break;
      }

      if (leads.length === 0) {
        console.log(' no more leads');
        break;
      }

      console.log(' got ' + leads.length + ' leads, updating...');

      // Process leads in this batch
      for (const lead of leads) {
        // Check if lead has replied
        const hasReplied = (lead.email_reply_count || 0) > 0;
        // Positive reply = manually tagged as interested/booked/etc (NOT just any reply)
        const positiveStatuses = ['interested', 'meeting_booked', 'meeting_completed', 'closed'];
        const isPositiveReply = positiveStatuses.includes(lead.interest_status || '');

        // Determine status: contacted → replied → meeting → closed_won / closed_lost
        let newStatus = null;
        if (lead.interest_status === 'closed') {
          newStatus = 'closed_won';
        } else if (lead.interest_status === 'not_interested' || lead.interest_status === 'wrong_person') {
          newStatus = 'closed_lost';
        } else if (lead.interest_status === 'meeting_booked' || lead.interest_status === 'meeting_completed') {
          newStatus = 'meeting';
        } else if (hasReplied || lead.interest_status === 'interested') {
          newStatus = 'replied';
        }

        // Update in database
        const updateData = {
          is_positive_reply: isPositiveReply,
          email_reply_count: lead.email_reply_count || 0,
          has_replied: hasReplied,
        };

        // Only add status if we have a new one and it's an upgrade
        if (newStatus) {
          updateData.status = newStatus;
        }

        const { data: result, error: updateError } = await supabase
          .from('leads')
          .update(updateData)
          .eq('campaign_id', campaign.id)
          .eq('email', lead.email)
          .select('id');

        if (result && result.length > 0) {
          campaignUpdated++;
        } else {
          campaignNotFound++;
        }
      }

      skip += limit;

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));

      if (leads.length < limit) {
        break;
      }
    }

    console.log('  Campaign done: updated=' + campaignUpdated + ', not_found=' + campaignNotFound);
    totalUpdated += campaignUpdated;
    totalNotFound += campaignNotFound;
    console.log('');
  }

  console.log('=== COMPLETE ===');
  console.log('Total updated:', totalUpdated);
  console.log('Total not found in DB:', totalNotFound);
}

refreshStatus().catch(console.error);
