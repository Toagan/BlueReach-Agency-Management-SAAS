// Sync Smartlead sent counts per variant
// Run: node scripts/sync-smartlead-sent-counts.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSmartleadApiKey(campaignId) {
  const { data } = await supabase
    .from('campaigns')
    .select('api_key_encrypted')
    .eq('id', campaignId)
    .single();
  return data?.api_key_encrypted;
}

async function fetchVariantMapping(apiKey, providerCampaignId) {
  const baseUrl = 'https://server.smartlead.ai/api/v1';

  console.log('Fetching variant mapping...');
  const seqRes = await fetch(`${baseUrl}/campaigns/${providerCampaignId}/sequences?api_key=${apiKey}`);
  const seqData = await seqRes.json();

  const variantMap = new Map();
  const sequences = Array.isArray(seqData) ? seqData : seqData.email_campaign_sequences || [];

  for (const step of sequences) {
    const variants = step.sequence_variants || step.seq_variants || [];
    for (const variant of variants) {
      const variantId = variant.id || variant.variant_id;
      if (variantId && variant.variant_label) {
        variantMap.set(variantId, {
          label: variant.variant_label,
          stepNumber: step.seq_number || step.sequence_number
        });
      }
    }
  }

  console.log(`Found ${variantMap.size} variants`);
  return variantMap;
}

async function fetchSentCountsPerVariant(apiKey, providerCampaignId, variantMap) {
  const baseUrl = 'https://server.smartlead.ai/api/v1';

  console.log('Fetching statistics for sent counts...');
  const allStats = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const statsRes = await fetch(`${baseUrl}/campaigns/${providerCampaignId}/statistics?api_key=${apiKey}&limit=${limit}&offset=${offset}`);
    const statsData = await statsRes.json();

    if (!statsData.data || statsData.data.length === 0) {
      hasMore = false;
    } else {
      allStats.push(...statsData.data);
      offset += limit;
      hasMore = statsData.data.length === limit;

      if (offset % 1000 === 0) {
        console.log(`Fetched ${offset} statistics records...`);
      }
    }
  }

  console.log(`Total stats fetched: ${allStats.length}`);

  // Count sent emails per step/variant
  const sentCounts = new Map();

  for (const stat of allStats) {
    const stepNumber = stat.sequence_number;
    const variantId = stat.seq_variant_id;

    if (!stepNumber || !variantId) continue;

    const variantInfo = variantMap.get(variantId);
    const variantLabel = variantInfo?.label || `Unknown-${variantId}`;

    const key = `${stepNumber}-${variantLabel}`;

    if (!sentCounts.has(key)) {
      sentCounts.set(key, {
        step: stepNumber,
        variant: variantLabel,
        variantId: variantId,
        sent: 0
      });
    }

    // Each stat record represents an email that was sent
    sentCounts.get(key).sent++;
  }

  return sentCounts;
}

async function syncCampaign(campaignId, campaignName) {
  console.log(`\n========== ${campaignName} ==========`);

  const apiKey = await getSmartleadApiKey(campaignId);
  if (!apiKey) {
    console.log('No API key found');
    return;
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('provider_campaign_id')
    .eq('id', campaignId)
    .single();

  if (!campaign?.provider_campaign_id) {
    console.log('No provider campaign ID');
    return;
  }

  const providerCampaignId = campaign.provider_campaign_id;
  console.log('Provider campaign ID:', providerCampaignId);

  // Get variant mapping
  const variantMap = await fetchVariantMapping(apiKey, providerCampaignId);

  // Get sent counts
  const sentCounts = await fetchSentCountsPerVariant(apiKey, providerCampaignId, variantMap);

  console.log('\nSent counts per variant:');
  const sorted = [...sentCounts.values()].sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step;
    return b.sent - a.sent;
  });

  for (const s of sorted) {
    console.log(`  Step ${s.step} - Variant ${s.variant}: ${s.sent} sent`);
  }

  // Now we need to store this somewhere
  // Option 1: Create lead_emails records for each sent email
  // Option 2: Create a campaign_variant_stats table
  // For now, let's update lead_emails with dummy records to track sent counts

  console.log('\nTo display sent counts, we need to populate lead_emails with variant data.');
  console.log('This would require creating email records for each sent email.');

  return sentCounts;
}

async function main() {
  console.log('Syncing Smartlead sent counts per variant...\n');

  const sentCounts = await syncCampaign(
    'ef7ec304-406f-49f6-8556-1a51ccd199a7',
    'Finance Professors Weltweit'
  );

  if (sentCounts) {
    console.log('\n========== Summary ==========');
    let totalSent = 0;
    for (const s of sentCounts.values()) {
      totalSent += s.sent;
    }
    console.log(`Total emails sent: ${totalSent}`);
    console.log(`Unique step/variant combinations: ${sentCounts.size}`);
  }

  console.log('\n========== Done ==========');
}

main().catch(console.error);
