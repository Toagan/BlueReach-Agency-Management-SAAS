require('dotenv').config({ path: '.env.local' });

async function fetchSmartleadSentCounts(apiKey, providerCampaignId) {
  const baseUrl = "https://server.smartlead.ai/api/v1";

  // First get variant mapping (variant ID -> label) and total count
  const [seqRes, analyticsRes] = await Promise.all([
    fetch(`${baseUrl}/campaigns/${providerCampaignId}/sequences?api_key=${apiKey}`),
    fetch(`${baseUrl}/campaigns/${providerCampaignId}/analytics?api_key=${apiKey}`),
  ]);

  const seqData = await seqRes.json();
  const analytics = await analyticsRes.json();
  const totalSent = parseInt(analytics.sent_count) || 0;

  console.log('Total sent count from analytics:', totalSent);

  const variantMap = new Map();
  const sequences = Array.isArray(seqData) ? seqData : seqData.email_campaign_sequences || [];

  for (const step of sequences) {
    const variants = step.sequence_variants || step.seq_variants || [];
    for (const variant of variants) {
      const variantId = variant.id || variant.variant_id;
      if (variantId && variant.variant_label) {
        variantMap.set(variantId, {
          label: variant.variant_label,
          stepNumber: step.seq_number || step.sequence_number || 1,
        });
      }
    }
  }

  console.log('Variant map size:', variantMap.size);

  // Fetch statistics with parallel requests
  const allStats = [];
  const limit = 500;
  const totalPages = Math.ceil(totalSent / limit);
  const batchSize = 10;

  console.log('Total pages needed:', totalPages);

  for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalPages);
    const pagePromises = [];

    for (let page = batchStart; page < batchEnd; page++) {
      const offset = page * limit;
      pagePromises.push(
        fetch(`${baseUrl}/campaigns/${providerCampaignId}/statistics?api_key=${apiKey}&limit=${limit}&offset=${offset}`)
          .then(res => res.json())
          .then(data => data.data || [])
          .catch(err => {
            console.error('Fetch error at offset', offset, err.message);
            return [];
          })
      );
    }

    const batchResults = await Promise.all(pagePromises);
    for (const pageData of batchResults) {
      allStats.push(...pageData);
    }

    console.log(`Batch ${Math.floor(batchStart / batchSize) + 1}: fetched ${batchResults.reduce((s, d) => s + d.length, 0)} records, total: ${allStats.length}`);

    if (batchStart + batchSize < totalPages) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\nTotal stats fetched:', allStats.length);

  // Count sent emails per step/variant
  const sentCounts = new Map();

  for (const stat of allStats) {
    const stepNumber = stat.sequence_number;
    const variantId = stat.seq_variant_id;

    if (!stepNumber || !variantId) continue;

    const variantInfo = variantMap.get(variantId);
    const variantLabel = variantInfo?.label || 'Unknown';

    const key = `${stepNumber}-${variantLabel}`;

    if (!sentCounts.has(key)) {
      sentCounts.set(key, {
        step: stepNumber,
        variant: variantLabel,
        variantId: variantId,
        sent: 0,
      });
    }

    sentCounts.get(key).sent++;
  }

  return sentCounts;
}

async function main() {
  const apiKey = 'REDACTED_SMARTLEAD_API_KEY';
  const campaignId = '2413311';

  console.log('Starting fetch...\n');
  const start = Date.now();

  const sentCounts = await fetchSmartleadSentCounts(apiKey, campaignId);

  console.log('\nTime taken:', (Date.now() - start) / 1000, 'seconds');
  console.log('\nSent counts per variant:');

  const sorted = [...sentCounts.values()].sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step;
    return b.sent - a.sent;
  });

  for (const s of sorted) {
    console.log(`  Step ${s.step} - Variant ${s.variant}: ${s.sent} sent`);
  }

  const total = sorted.reduce((sum, s) => sum + s.sent, 0);
  console.log('\nTotal:', total);
}

main().catch(console.error);
