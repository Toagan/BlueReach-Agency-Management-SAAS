// Generate a complete sample skill file
// Run: node scripts/generate-sample-skill.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateSkillFile(campaignId) {
  // Get campaign
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, name, provider_type, client_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    console.log('Campaign not found:', campErr);
    return null;
  }

  // Get client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('name, product_service, icp, verticals, acv, website, notes')
    .eq('id', campaign.client_id)
    .single();

  if (!client) {
    console.log('Client not found:', clientErr);
    return null;
  }

  // Get sequences
  const { data: sequences } = await supabase
    .from('campaign_sequences')
    .select('step_number, variant, subject, body_text, body_html')
    .eq('campaign_id', campaignId)
    .order('step_number')
    .order('variant');

  // Get variant performance
  const { data: leads } = await supabase
    .from('leads')
    .select('reply_from_step, reply_from_variant_label, is_positive_reply')
    .eq('campaign_id', campaignId)
    .eq('has_replied', true);

  const stats = {};
  for (const l of leads || []) {
    if (l.reply_from_step !== null) {
      const key = `Step ${l.reply_from_step} - ${l.reply_from_variant_label || 'Unknown'}`;
      if (!stats[key]) stats[key] = { replies: 0, positive: 0 };
      stats[key].replies++;
      if (l.is_positive_reply) stats[key].positive++;
    }
  }
  const sortedStats = Object.entries(stats).sort((a, b) => b[1].positive - a[1].positive);

  // Strip HTML
  const stripHtml = (html) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
  };

  // Build skill file
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

**Industries:** ${(client.verticals || []).join(', ') || 'Not specified'}

${client.acv ? `**Deal size:** $${client.acv.toLocaleString()} ACV` : ''}

${client.notes ? `**Notes:** ${client.notes}` : ''}

---

## Performance Data (What's Working)
`;

  if (sortedStats.length > 0) {
    content += '\n';
    for (const [key, s] of sortedStats.slice(0, 8)) {
      const rate = s.replies > 0 ? ((s.positive / s.replies) * 100).toFixed(0) : 0;
      content += `- ${key}: ${s.positive} positive replies, ${rate}% conversion\n`;
    }
    content += `\n**Key insight:** ${sortedStats[0][0]} is the top performer. Analyze what makes it work.\n`;
  } else {
    content += 'No performance data yet. Create variations based on cold email best practices.\n';
  }

  content += '\n---\n\n## Current Email Copy\n';

  // Group by step
  const stepGroups = {};
  for (const seq of sequences || []) {
    if (!stepGroups[seq.step_number]) stepGroups[seq.step_number] = [];
    stepGroups[seq.step_number].push(seq);
  }

  for (const [step, variants] of Object.entries(stepGroups).sort((a, b) => a[0] - b[0])) {
    content += `\n### Step ${step}${step === '1' ? ' (Initial Email)' : ' (Follow-up)'}\n`;
    for (const v of variants) {
      content += `\n**Variant ${v.variant}**\n`;
      content += `Subject: ${v.subject || '(No subject)'}\n\n`;
      content += `${stripHtml(v.body_html) || v.body_text || '(No body)'}\n`;
    }
  }

  content += `
---

## Available Personalization Variables
- {{firstName}} - Lead's first name
- {{lastName}} - Lead's last name
- {{companyName}} - Lead's company
- {{1st line}} - Custom personalization/icebreaker

---

## Your Instructions

Now ask me 3-5 clarifying multiple choice questions (with recommendations), then provide 5 email variations.

**Start by asking your clarifying questions now.**
`;

  return content;
}

async function main() {
  console.log('Generating sample skill files...\n');

  // Generate for Instantly campaign (has sequences)
  const instantlySkill = await generateSkillFile('7df6f97e-3c1f-4370-9bbd-8bf88546e521');

  // Save to file
  fs.writeFileSync('/tmp/sample-skill-instantly.md', instantlySkill);
  console.log('Saved: /tmp/sample-skill-instantly.md');

  // Print it
  console.log('\n' + '='.repeat(70));
  console.log('SAMPLE SKILL FILE (Instantly - Gebaudereiniger, SEO)');
  console.log('='.repeat(70));
  console.log(instantlySkill);
}

main().catch(console.error);
