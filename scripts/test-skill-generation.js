// Test A/B testing data and skill file generation for both Smartlead and Instantly
// Run: node scripts/test-skill-generation.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaign(campaignId, campaignName, providerType) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TESTING: ${campaignName} (${providerType})`);
  console.log(`Campaign ID: ${campaignId}`);
  console.log('='.repeat(70));

  // 1. Get campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, original_name, provider_type, client_id')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    console.log('ERROR: Campaign not found');
    return null;
  }

  // 2. Get client details
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('name, product_service, verticals, offer, icp, acv, website')
    .eq('id', campaign.client_id)
    .single();

  if (clientError || !client) {
    console.log('ERROR: Client not found');
    return null;
  }

  console.log(`\nClient: ${client.name}`);
  console.log(`Product: ${client.product_service || 'Not set'}`);

  // 3. Get email sequences
  const { data: sequences, error: seqError } = await supabase
    .from('campaign_sequences')
    .select('step_number, variant, subject, body_text')
    .eq('campaign_id', campaignId)
    .order('step_number')
    .order('variant');

  console.log(`\nEmail Sequences: ${sequences?.length || 0} variants`);
  if (sequences && sequences.length > 0) {
    const steps = [...new Set(sequences.map(s => s.step_number))];
    const variants = [...new Set(sequences.map(s => s.variant))];
    console.log(`  Steps: ${steps.join(', ')}`);
    console.log(`  Variants: ${variants.join(', ')}`);
  }

  // 4. Get variant performance from leads
  const { data: leadsWithReplies, error: leadsError } = await supabase
    .from('leads')
    .select('reply_from_step, reply_from_variant_label, is_positive_reply')
    .eq('campaign_id', campaignId)
    .eq('has_replied', true);

  console.log(`\nLeads with replies: ${leadsWithReplies?.length || 0}`);

  // Calculate variant stats
  const variantStats = new Map();
  if (leadsWithReplies) {
    for (const lead of leadsWithReplies) {
      if (lead.reply_from_step === null) continue;

      const key = `Step ${lead.reply_from_step} - ${lead.reply_from_variant_label || 'Unknown'}`;
      if (!variantStats.has(key)) {
        variantStats.set(key, { replies: 0, positive: 0 });
      }
      const stats = variantStats.get(key);
      stats.replies++;
      if (lead.is_positive_reply) stats.positive++;
    }
  }

  console.log(`\nVariant Performance:`);
  if (variantStats.size > 0) {
    const sorted = [...variantStats.entries()].sort((a, b) => b[1].positive - a[1].positive);
    for (const [key, stats] of sorted.slice(0, 10)) {
      const rate = stats.replies > 0 ? ((stats.positive / stats.replies) * 100).toFixed(0) : 0;
      console.log(`  ${key}: ${stats.replies} replies, ${stats.positive} positive (${rate}%)`);
    }
  } else {
    console.log('  No variant tracking data available');
  }

  // 5. Check lead_emails for variant data
  const { data: emailsWithVariant, count: emailVariantCount } = await supabase
    .from('lead_emails')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .not('sequence_variant', 'is', null);

  console.log(`\nEmails with variant tracking: ${emailVariantCount || 0}`);

  return {
    campaign,
    client,
    sequences: sequences || [],
    variantStats,
    hasVariantData: variantStats.size > 0
  };
}

async function generateSampleSkillFile(data) {
  if (!data) return null;

  const { campaign, client, sequences, variantStats } = data;

  let content = `# Email A/B Test Copy Generator

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

**Industries:** ${client.verticals?.join(', ') || 'Not specified'}

**Value proposition:** ${client.offer || 'Not specified'}

${client.acv ? `**Deal size:** $${client.acv.toLocaleString()} ACV` : ''}

---

## Performance Data (What's Working)
`;

  if (variantStats.size > 0) {
    const sorted = [...variantStats.entries()].sort((a, b) => b[1].positive - a[1].positive);
    for (const [key, stats] of sorted.slice(0, 8)) {
      const rate = stats.replies > 0 ? ((stats.positive / stats.replies) * 100).toFixed(0) : 0;
      content += `- ${key}: ${stats.positive} positive replies, ${rate}% conversion\n`;
    }

    const best = sorted[0];
    if (best) {
      content += `\n**Key insight:** ${best[0]} is the top performer. Analyze what makes it work.\n`;
    }
  } else {
    content += `No performance data yet. Create variations based on cold email best practices.\n`;
  }

  content += `\n---\n\n## Current Email Copy\n`;

  // Group sequences by step
  const stepGroups = new Map();
  for (const seq of sequences) {
    if (!stepGroups.has(seq.step_number)) stepGroups.set(seq.step_number, []);
    stepGroups.get(seq.step_number).push(seq);
  }

  for (const [step, variants] of [...stepGroups.entries()].sort((a, b) => a[0] - b[0])) {
    content += `\n### Step ${step}${step === 1 ? ' (Initial Email)' : ' (Follow-up)'}\n`;
    for (const v of variants) {
      content += `\n**Variant ${v.variant}**\n`;
      content += `Subject: ${v.subject || '(No subject)'}\n\n`;
      content += `${v.body_text?.substring(0, 300) || '(No body)'}${v.body_text?.length > 300 ? '...' : ''}\n`;
    }
  }

  content += `
---

## Your Instructions

Now ask me 3-5 clarifying multiple choice questions (with recommendations), then provide 5 email variations.

**Start by asking your clarifying questions now.**
`;

  return content;
}

async function main() {
  console.log('Testing A/B Test Data & Skill Generation');
  console.log('========================================\n');

  // Test Smartlead campaign (Finance Professors Weltweit)
  const smartleadResult = await testCampaign(
    'ef7ec304-406f-49f6-8556-1a51ccd199a7',
    'Finance Professors Weltweit',
    'Smartlead'
  );

  // Test Instantly campaign (pick one with most replies)
  const instantlyResult = await testCampaign(
    '7df6f97e-3c1f-4370-9bbd-8bf88546e521',
    'Gebaudereiniger, SEO',
    'Instantly'
  );

  // Generate sample skill file for Smartlead campaign
  console.log('\n' + '='.repeat(70));
  console.log('SAMPLE SKILL FILE (Smartlead Campaign)');
  console.log('='.repeat(70));

  const skillFile = await generateSampleSkillFile(smartleadResult);
  if (skillFile) {
    console.log('\n' + skillFile);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nSmartlead (Finance Professors):`);
  console.log(`  - Variant tracking: ${smartleadResult?.hasVariantData ? 'YES' : 'NO'}`);
  console.log(`  - Sequences: ${smartleadResult?.sequences.length || 0}`);

  console.log(`\nInstantly (Gebaudereiniger):`);
  console.log(`  - Variant tracking: ${instantlyResult?.hasVariantData ? 'YES' : 'NO'}`);
  console.log(`  - Sequences: ${instantlyResult?.sequences.length || 0}`);
  console.log(`  - Note: Instantly variant tracking requires new webhook events after deployment`);
}

main().catch(console.error);
