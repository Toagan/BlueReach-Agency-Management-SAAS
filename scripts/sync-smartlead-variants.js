// Sync Smartlead campaigns with variant tracking
// Run: node scripts/sync-smartlead-variants.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSmartleadApiKey(campaignId) {
  // API key is stored per-campaign
  const { data } = await supabase
    .from('campaigns')
    .select('api_key_encrypted')
    .eq('id', campaignId)
    .single();
  return data?.api_key_encrypted;
}

async function fetchStatisticsWithVariants(apiKey, campaignId) {
  const baseUrl = 'https://server.smartlead.ai/api/v1';

  // Fetch sequences for variant mapping
  console.log('Fetching sequences...');
  const seqRes = await fetch(`${baseUrl}/campaigns/${campaignId}/sequences?api_key=${apiKey}`);
  const seqData = await seqRes.json();

  const variantMap = new Map();

  // Handle both API response formats:
  // 1. Direct array: [{ seq_number, sequence_variants: [...] }]
  // 2. Wrapped: { email_campaign_sequences: [...] }
  const sequences = Array.isArray(seqData) ? seqData : seqData.email_campaign_sequences || [];

  for (const step of sequences) {
    // Handle both field names: sequence_variants or seq_variants
    const variants = step.sequence_variants || step.seq_variants || [];
    for (const variant of variants) {
      // Handle both ID field names: id or variant_id
      const variantId = variant.id || variant.variant_id;
      if (variantId && variant.variant_label) {
        variantMap.set(variantId, variant.variant_label);
      }
    }
  }
  console.log('Variant mapping:', Object.fromEntries(variantMap));
  console.log('Total variants found:', variantMap.size);

  // Fetch all statistics with pagination
  console.log('Fetching statistics...');
  const allStats = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const statsRes = await fetch(`${baseUrl}/campaigns/${campaignId}/statistics?api_key=${apiKey}&limit=${limit}&offset=${offset}`);
    const statsData = await statsRes.json();

    if (!statsData.data || statsData.data.length === 0) {
      hasMore = false;
    } else {
      allStats.push(...statsData.data);
      offset += limit;
      hasMore = statsData.data.length === limit;

      if (offset % 500 === 0) {
        console.log(`Fetched ${offset} statistics records...`);
      }
    }
  }

  console.log('Total stats fetched:', allStats.length);

  // Group by email with variant info
  const leadStats = new Map();
  for (const stat of allStats) {
    const email = stat.lead_email?.toLowerCase();
    if (!email) continue;

    const variantLabel = variantMap.get(stat.seq_variant_id) || null;

    const existing = leadStats.get(email);
    // Keep track of the reply that happened (if any)
    if (!existing) {
      leadStats.set(email, {
        category: stat.lead_category,
        replyTime: stat.reply_time,
        replyFromStep: stat.reply_time ? stat.sequence_number : null,
        replyFromVariant: stat.reply_time ? stat.seq_variant_id : null,
        replyFromVariantLabel: stat.reply_time ? variantLabel : null,
      });
    } else if (stat.reply_time && !existing.replyTime) {
      // Found a reply for this lead
      existing.replyTime = stat.reply_time;
      existing.replyFromStep = stat.sequence_number;
      existing.replyFromVariant = stat.seq_variant_id;
      existing.replyFromVariantLabel = variantLabel;
    }
  }

  return leadStats;
}

async function syncCampaign(campaignId, campaignName) {
  console.log(`\n========== Syncing: ${campaignName} ==========`);

  const apiKey = await getSmartleadApiKey(campaignId);
  if (!apiKey) {
    console.log('No Smartlead API key found for this campaign');
    return;
  }

  // Get provider campaign ID
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

  const leadStats = await fetchStatisticsWithVariants(apiKey, providerCampaignId);
  console.log('Leads with stats:', leadStats.size);

  // Count leads with replies
  let leadsWithReplies = 0;
  for (const [, stats] of leadStats) {
    if (stats.replyFromStep !== null) leadsWithReplies++;
  }
  console.log('Leads with replies:', leadsWithReplies);

  // Update leads with variant info
  let updated = 0;
  let errors = 0;

  for (const [email, stats] of leadStats) {
    if (stats.replyFromStep !== null) {
      const { error } = await supabase
        .from('leads')
        .update({
          reply_from_step: stats.replyFromStep,
          reply_from_variant: stats.replyFromVariant,
          reply_from_variant_label: stats.replyFromVariantLabel,
        })
        .eq('campaign_id', campaignId)
        .ilike('email', email);

      if (error) {
        errors++;
        if (errors <= 3) console.log('Error updating:', email, error.message);
      } else {
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} leads with variant tracking (${errors} errors)`);
}

async function main() {
  console.log('Starting Smartlead variant sync...\n');

  await syncCampaign('ef7ec304-406f-49f6-8556-1a51ccd199a7', 'Finance Professors Weltweit');
  await syncCampaign('491a7845-bfb8-426b-afde-dee6b5238602', 'Fintechs Pilot');

  console.log('\n========== Done! ==========');
}

main().catch(console.error);
