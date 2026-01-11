// Generate Claude Skill File for A/B Test Optimization
// Downloads a .md skill file that can be used with Claude to generate new email variants

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface VariantPerformance {
  step: number;
  variant: string;
  replies: number;
  positiveReplies: number;
  replyRate: number;
  positiveRate: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, original_name, provider_type, client_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // 2. Fetch client details
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, product_service, verticals, offer, icp, acv, tcv, tam, website, notes")
      .eq("id", campaign.client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 3. Fetch email sequences
    const { data: sequences, error: seqError } = await supabase
      .from("campaign_sequences")
      .select("step_number, variant, subject, body_text, body_html, delay_days")
      .eq("campaign_id", campaignId)
      .order("step_number", { ascending: true })
      .order("variant", { ascending: true });

    // 4. Fetch variant performance from leads table
    const { data: leadsWithReplies, error: leadsError } = await supabase
      .from("leads")
      .select("reply_from_step, reply_from_variant_label, is_positive_reply")
      .eq("campaign_id", campaignId)
      .eq("has_replied", true);

    // 5. Calculate variant performance
    const variantStats = new Map<string, VariantPerformance>();

    if (leadsWithReplies) {
      for (const lead of leadsWithReplies) {
        if (lead.reply_from_step === null) continue;

        const key = `${lead.reply_from_step}-${lead.reply_from_variant_label || 'Unknown'}`;

        if (!variantStats.has(key)) {
          variantStats.set(key, {
            step: lead.reply_from_step,
            variant: lead.reply_from_variant_label || 'Unknown',
            replies: 0,
            positiveReplies: 0,
            replyRate: 0,
            positiveRate: 0,
          });
        }

        const stats = variantStats.get(key)!;
        stats.replies++;
        if (lead.is_positive_reply) {
          stats.positiveReplies++;
        }
      }
    }

    // Sort by positive replies
    const performanceData = Array.from(variantStats.values())
      .sort((a, b) => b.positiveReplies - a.positiveReplies);

    // Find best performer per step
    const bestPerStep = new Map<number, VariantPerformance>();
    for (const perf of performanceData) {
      if (!bestPerStep.has(perf.step) || perf.positiveReplies > bestPerStep.get(perf.step)!.positiveReplies) {
        bestPerStep.set(perf.step, perf);
      }
    }

    // 6. Generate the skill file content
    const skillContent = generateSkillFile(campaign, client, sequences || [], performanceData, bestPerStep);

    // 7. Return as downloadable file
    const filename = `${campaign.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-ab-optimizer.md`;

    return new NextResponse(skillContent, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GenerateSkill] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate skill file" },
      { status: 500 }
    );
  }
}

function generateSkillFile(
  campaign: { name: string; original_name: string | null; provider_type: string | null },
  client: {
    name: string;
    product_service: string | null;
    verticals: string[] | null;
    offer: string | null;
    icp: string | null;
    acv: number | null;
    tcv: number | null;
    tam: number | null;
    website: string | null;
    notes: string | null;
  },
  sequences: Array<{
    step_number: number;
    variant: string;
    subject: string | null;
    body_text: string | null;
    body_html: string | null;
    delay_days: number;
  }>,
  performanceData: VariantPerformance[],
  bestPerStep: Map<number, VariantPerformance>
): string {
  // Group sequences by step
  const stepGroups = new Map<number, typeof sequences>();
  for (const seq of sequences) {
    if (!stepGroups.has(seq.step_number)) {
      stepGroups.set(seq.step_number, []);
    }
    stepGroups.get(seq.step_number)!.push(seq);
  }

  // Strip HTML tags for cleaner text
  const stripHtml = (html: string | null): string => {
    if (!html) return "";
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  };

  // Build the skill file
  let content = `---
name: ${campaign.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-ab-optimizer
description: Generate optimized A/B test email variants for ${client.name}'s cold outreach campaign. Use when asked to create new email variations, optimize copy, or improve response rates.
---

# Email A/B Test Optimizer

## Campaign: ${campaign.name}
${campaign.original_name && campaign.original_name !== campaign.name ? `Original Name: ${campaign.original_name}` : ""}

---

## Client Context

**Company:** ${client.name}
${client.website ? `**Website:** ${client.website}` : ""}

### Product/Service
${client.product_service || "Not specified"}

### Target Verticals
${client.verticals && client.verticals.length > 0 ? client.verticals.map(v => `- ${v}`).join("\n") : "Not specified"}

### Ideal Customer Profile (ICP)
${client.icp || "Not specified"}

### Value Proposition / Offer
${client.offer || "Not specified"}

### Deal Size
${client.acv ? `- Average Contract Value (ACV): $${client.acv.toLocaleString()}` : ""}
${client.tcv ? `- Total Contract Value (TCV): $${client.tcv.toLocaleString()}` : ""}
${client.tam ? `- Total Addressable Market: ${client.tam.toLocaleString()} leads` : ""}

${client.notes ? `### Additional Notes\n${client.notes}` : ""}

---

## Performance Data

### What Has Worked Best
`;

  // Add performance summary
  if (performanceData.length > 0) {
    content += `
| Step | Variant | Total Replies | Positive Replies | Win Rate |
|------|---------|---------------|------------------|----------|
`;
    for (const perf of performanceData.slice(0, 10)) {
      const winRate = perf.replies > 0 ? ((perf.positiveReplies / perf.replies) * 100).toFixed(0) : "0";
      const isBest = bestPerStep.get(perf.step)?.variant === perf.variant;
      content += `| ${perf.step} | ${perf.variant}${isBest ? " **BEST**" : ""} | ${perf.replies} | ${perf.positiveReplies} | ${winRate}% |\n`;
    }

    content += `
### Key Insights
`;
    for (const [step, best] of Array.from(bestPerStep.entries()).sort((a, b) => a[0] - b[0])) {
      content += `- **Step ${step}:** Variant ${best.variant} performs best with ${best.positiveReplies} positive replies\n`;
    }
  } else {
    content += `No performance data available yet. Generate variations based on email copy best practices.\n`;
  }

  // Add current email sequences
  content += `
---

## Current Email Sequences

`;

  for (const [stepNum, variants] of Array.from(stepGroups.entries()).sort((a, b) => a[0] - b[0])) {
    content += `### Step ${stepNum}${stepNum === 1 ? " (Initial Email)" : ` (Follow-up, +${variants[0]?.delay_days || 0} days)`}\n\n`;

    for (const variant of variants) {
      const isBest = bestPerStep.get(stepNum)?.variant === variant.variant;
      content += `#### Variant ${variant.variant}${isBest ? " - TOP PERFORMER" : ""}\n\n`;
      content += `**Subject:** ${variant.subject || "(No subject)"}\n\n`;
      content += `**Body:**\n\`\`\`\n${stripHtml(variant.body_html) || variant.body_text || "(No body)"}\n\`\`\`\n\n`;
    }
  }

  // Add instructions for generating new variants
  content += `---

## Your Task

When asked to generate new email variants, follow these guidelines:

### Step 1: Ask Which Step to Optimize
Ask the user: "Which email step would you like to optimize? Available steps: ${Array.from(stepGroups.keys()).sort().join(", ")}"

### Step 2: Analyze Top Performers
Review the performance data above. Identify what makes the best-performing variants successful:
- Subject line patterns (curiosity, personalization, length)
- Opening hooks (problem statement, personalization, pattern interrupt)
- Value proposition framing
- Call-to-action style
- Tone and voice

### Step 3: Generate New Variants
Create 3 NEW variants (labeled with next available letters) that:

1. **Build on what works:** Incorporate successful elements from top performers
2. **Test new hypotheses:** Each variant should test a different approach:
   - Variant A alternative: Different subject line angle
   - Variant B alternative: Different opening hook
   - Variant C alternative: Different CTA approach
3. **Maintain brand voice:** Match the professional tone of existing emails
4. **Keep personalization:** Preserve {{firstName}}, {{companyName}}, and custom variables

### Step 4: Output Format
For each new variant, provide:

\`\`\`
VARIANT [LETTER]
Subject: [subject line]

Body:
[email body with personalization variables preserved]

Hypothesis: [what this variant is testing]
\`\`\`

---

## Best Practices for Cold Email

1. **Subject Lines:** 3-5 words, lowercase, curiosity-driven, avoid spam triggers
2. **First Line:** Personalized reference or pattern interrupt (not "I hope this finds you well")
3. **Value Prop:** Lead with outcome, not features
4. **Social Proof:** Brief mention of similar companies/results when relevant
5. **CTA:** Soft ask (interest-based) for first email, stronger for follow-ups
6. **Length:** 50-125 words for initial email, shorter for follow-ups
7. **Mobile First:** Most emails read on mobile, keep paragraphs short

## Variables Available
- {{firstName}} - Lead's first name
- {{lastName}} - Lead's last name
- {{companyName}} - Lead's company
- {{company_domain}} - Lead's website domain
- {{1st line}} / {{personalization}} - Custom personalization line
- {{2nd line}} - Secondary personalization (if available)

---

## Example Prompt to Use This Skill

"Generate 3 new A/B test variants for Step 1 that build on what's working in Variant B but test different subject line approaches."

"Create follow-up email variants for Step 2 that are more direct and outcome-focused."

"Analyze my current email performance and suggest which elements to keep vs. change in new variants."
`;

  return content;
}
