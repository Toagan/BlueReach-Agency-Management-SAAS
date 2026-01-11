// Query variant performance stats for Financialreports campaigns
// Run: node scripts/variant-stats.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getVariantStats(campaignId, campaignName) {
  console.log(`\n========== ${campaignName} ==========\n`);

  // Get all leads with reply tracking for this campaign
  const { data: leads, error } = await supabase
    .from('leads')
    .select('reply_from_step, reply_from_variant, reply_from_variant_label, is_positive_reply, has_replied')
    .eq('campaign_id', campaignId)
    .eq('has_replied', true);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`Total leads with replies: ${leads.length}`);

  // Group by variant
  const variantStats = new Map();

  for (const lead of leads) {
    const key = lead.reply_from_variant_label || `Step ${lead.reply_from_step}`;
    const step = lead.reply_from_step;

    if (!variantStats.has(key)) {
      variantStats.set(key, {
        step,
        variant: key,
        replies: 0,
        positiveReplies: 0,
      });
    }

    const stats = variantStats.get(key);
    stats.replies++;
    if (lead.is_positive_reply) {
      stats.positiveReplies++;
    }
  }

  // Convert to array and sort
  const statsList = Array.from(variantStats.values());

  // Sort by total replies
  console.log('\n--- REPLIES BY VARIANT (sorted by count) ---');
  const byReplies = [...statsList].sort((a, b) => b.replies - a.replies);
  for (const stat of byReplies) {
    console.log(`  Step ${stat.step} - Variant ${stat.variant}: ${stat.replies} replies`);
  }

  // Sort by positive replies
  console.log('\n--- POSITIVE REPLIES BY VARIANT (sorted by count) ---');
  const byPositive = [...statsList].sort((a, b) => b.positiveReplies - a.positiveReplies);
  for (const stat of byPositive) {
    console.log(`  Step ${stat.step} - Variant ${stat.variant}: ${stat.positiveReplies} positive replies`);
  }

  // Winner summary
  if (byReplies.length > 0) {
    console.log('\n--- WINNERS ---');
    console.log(`Most replies: ${byReplies[0].variant} (Step ${byReplies[0].step}) with ${byReplies[0].replies} replies`);
    if (byPositive[0].positiveReplies > 0) {
      console.log(`Most positive replies: ${byPositive[0].variant} (Step ${byPositive[0].step}) with ${byPositive[0].positiveReplies} positive replies`);
    }
  }
}

async function main() {
  console.log('Variant Performance Statistics for Financialreports\n');
  console.log('=' .repeat(60));

  await getVariantStats('ef7ec304-406f-49f6-8556-1a51ccd199a7', 'Finance Professors Weltweit');
  await getVariantStats('491a7845-bfb8-426b-afde-dee6b5238602', 'Fintechs Pilot');

  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main().catch(console.error);
