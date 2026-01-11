// Full test of A/B data and skill file generation
// Run: node scripts/test-full-flow.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaign(campaignId, label) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${label}`);
  console.log('='.repeat(70));

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, provider_type, client_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    console.log('Campaign not found');
    return null;
  }
  console.log(`\nCampaign: ${campaign.name} (${campaign.provider_type})`);

  // Get client
  const { data: client } = await supabase
    .from('clients')
    .select('name, product_service, icp, offer, verticals, acv, website')
    .eq('id', campaign.client_id)
    .single();

  if (client) {
    console.log(`Client: ${client.name}`);
    console.log(`Product: ${client.product_service || 'Not set'}`);
    console.log(`ICP: ${(client.icp || 'Not set').substring(0, 80)}...`);
  }

  // Get sequences
  const { data: sequences } = await supabase
    .from('campaign_sequences')
    .select('step_number, variant, subject, body_text')
    .eq('campaign_id', campaignId)
    .order('step_number')
    .order('variant');

  console.log(`\nEmail Sequences: ${sequences?.length || 0} total`);
  if (sequences && sequences.length > 0) {
    const steps = [...new Set(sequences.map(s => s.step_number))];
    const variants = [...new Set(sequences.map(s => s.variant))];
    console.log(`  Steps: ${steps.join(', ')}`);
    console.log(`  Variants per step: ${variants.join(', ')}`);

    // Show sample
    console.log(`\n  Sample (Step 1, Variant A):`);
    const sample = sequences.find(s => s.step_number === 1 && s.variant === 'A');
    if (sample) {
      console.log(`    Subject: ${sample.subject || 'N/A'}`);
      console.log(`    Body: ${(sample.body_text || 'N/A').substring(0, 100)}...`);
    }
  }

  // Get variant performance
  const { data: leads } = await supabase
    .from('leads')
    .select('reply_from_step, reply_from_variant_label, is_positive_reply')
    .eq('campaign_id', campaignId)
    .eq('has_replied', true);

  console.log(`\nLeads with replies: ${leads?.length || 0}`);

  const stats = {};
  let withVariantData = 0;
  for (const l of leads || []) {
    if (l.reply_from_step !== null) {
      withVariantData++;
      const key = `Step ${l.reply_from_step} - ${l.reply_from_variant_label || 'Unknown'}`;
      if (!stats[key]) stats[key] = { replies: 0, positive: 0 };
      stats[key].replies++;
      if (l.is_positive_reply) stats[key].positive++;
    }
  }

  console.log(`Leads with variant tracking: ${withVariantData}`);
  console.log(`\nVariant Performance (Top 10):`);

  const sorted = Object.entries(stats).sort((a, b) => b[1].positive - a[1].positive);
  if (sorted.length > 0) {
    for (const [key, s] of sorted.slice(0, 10)) {
      const rate = s.replies > 0 ? ((s.positive / s.replies) * 100).toFixed(0) : 0;
      console.log(`  ${key}: ${s.replies} replies, ${s.positive} positive (${rate}% conversion)`);
    }
  } else {
    console.log('  No variant tracking data available');
  }

  return { campaign, client, sequences, stats: sorted, hasData: sorted.length > 0 };
}

async function generateSkillPreview(data) {
  if (!data || !data.client) return;

  const { campaign, client, sequences, stats } = data;

  console.log(`\n${'='.repeat(70)}`);
  console.log('GENERATED SKILL FILE PREVIEW');
  console.log('='.repeat(70));

  let output = `
# Email A/B Test Copy Generator

You are a top 1% cold email copywriter. I need you to help me create new email variations for my outreach campaign.

## How This Works
1. First, review the campaign context and performance data below
2. Ask me clarifying multiple choice questions (include your recommendations)
3. I'll answer your questions
4. Then provide me with 5 final copy variations based on the best performing copy

---

## Campaign: ${campaign.name}

### Client: ${client.name}
${client.website ? `Website: ${client.website}` : ''}

**What they sell:** ${client.product_service || 'Not specified'}

**Target audience:** ${client.icp || 'Not specified'}

**Industries:** ${(client.verticals || []).join(', ') || 'Not specified'}

**Value proposition:** ${client.offer || 'Not specified'}

${client.acv ? `**Deal size:** $${client.acv.toLocaleString()} ACV` : ''}

---

## Performance Data (What's Working)
`;

  if (stats.length > 0) {
    for (const [key, s] of stats.slice(0, 8)) {
      const rate = s.replies > 0 ? ((s.positive / s.replies) * 100).toFixed(0) : 0;
      output += `- ${key}: ${s.positive} positive replies, ${rate}% conversion\n`;
    }
    output += `\n**Key insight:** ${stats[0][0]} is the top performer. Analyze what makes it work.\n`;
  } else {
    output += `No performance data yet. Create variations based on cold email best practices.\n`;
  }

  output += `\n---\n\n## Current Email Copy\n`;

  // Group by step
  const stepGroups = {};
  for (const seq of sequences || []) {
    if (!stepGroups[seq.step_number]) stepGroups[seq.step_number] = [];
    stepGroups[seq.step_number].push(seq);
  }

  for (const [step, variants] of Object.entries(stepGroups).sort((a, b) => a[0] - b[0])) {
    output += `\n### Step ${step}${step === '1' ? ' (Initial Email)' : ' (Follow-up)'}\n`;
    for (const v of variants.slice(0, 3)) { // Show max 3 per step for preview
      output += `\n**Variant ${v.variant}**\n`;
      output += `Subject: ${v.subject || '(No subject)'}\n\n`;
      const body = v.body_text || '(No body)';
      output += `${body.substring(0, 200)}${body.length > 200 ? '...' : ''}\n`;
    }
  }

  output += `
---

## Your Instructions

Now ask me 3-5 clarifying multiple choice questions (with recommendations), then provide 5 email variations.

**Start by asking your clarifying questions now.**
`;

  console.log(output);
}

async function main() {
  console.log('FULL A/B TEST DATA & SKILL GENERATION TEST');
  console.log('==========================================');

  // Test Smartlead campaign
  const smartlead = await testCampaign(
    'ef7ec304-406f-49f6-8556-1a51ccd199a7',
    'SMARTLEAD: Finance Professors Weltweit'
  );

  // Test Instantly campaign
  const instantly = await testCampaign(
    '7df6f97e-3c1f-4370-9bbd-8bf88546e521',
    'INSTANTLY: Gebaudereiniger, SEO'
  );

  // Generate skill preview for the one with best data
  if (smartlead?.hasData) {
    await generateSkillPreview(smartlead);
  } else if (instantly?.hasData) {
    await generateSkillPreview(instantly);
  } else {
    console.log('\nNo variant data available for skill preview');
    // Still generate preview without performance data
    if (smartlead) await generateSkillPreview(smartlead);
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`
Smartlead (Finance Professors Weltweit):
  - Has variant performance data: ${smartlead?.hasData ? 'YES' : 'NO'}
  - Email sequences synced: ${smartlead?.sequences?.length || 0}
  - Top performer: ${smartlead?.stats?.[0]?.[0] || 'N/A'}

Instantly (Gebaudereiniger, SEO):
  - Has variant performance data: ${instantly?.hasData ? 'YES' : 'NO'}
  - Email sequences synced: ${instantly?.sequences?.length || 0}
  - Note: Variant tracking for Instantly requires new webhook events after code deployment
`);
}

main().catch(console.error);
