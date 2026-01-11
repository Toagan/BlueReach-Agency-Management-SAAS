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

  // Build the prompt file
  let content = `# Generate 5 New A/B Test Email Variations

## Your Task
Based on the campaign context, current email copy, and performance data below, generate **5 new email variations** that will likely outperform the current ones. Each variation should test a different hypothesis while maintaining the core message.

---

## Client: ${client.name}
${client.website ? `Website: ${client.website}` : ""}

**What they sell:** ${client.product_service || "Not specified"}

**Target audience:** ${client.icp || "Not specified"}

**Industries:** ${client.verticals && client.verticals.length > 0 ? client.verticals.join(", ") : "Not specified"}

**Value proposition:** ${client.offer || "Not specified"}

${client.acv ? `**Deal size:** $${client.acv.toLocaleString()} ACV` : ""}

${client.notes ? `**Notes:** ${client.notes}` : ""}

---

## What's Working (Performance Data)
`;

  // Add performance summary
  if (performanceData.length > 0) {
    content += `\n`;
    for (const perf of performanceData.slice(0, 8)) {
      const winRate = perf.replies > 0 ? ((perf.positiveReplies / perf.replies) * 100).toFixed(0) : "0";
      const isBest = bestPerStep.get(perf.step)?.variant === perf.variant;
      content += `- Step ${perf.step}, Variant ${perf.variant}${isBest ? " (BEST)" : ""}: ${perf.positiveReplies} positive replies, ${winRate}% conversion\n`;
    }

    content += `\n**Key insight:** `;
    const bestOverall = performanceData[0];
    if (bestOverall) {
      content += `Variant ${bestOverall.variant} on Step ${bestOverall.step} is the top performer. Analyze what makes it work and build on those elements.\n`;
    }
  } else {
    content += `No performance data yet. Create variations based on cold email best practices.\n`;
  }

  // Add current email sequences
  content += `
---

## Current Email Copy
`;

  for (const [stepNum, variants] of Array.from(stepGroups.entries()).sort((a, b) => a[0] - b[0])) {
    content += `\n### Step ${stepNum}${stepNum === 1 ? " (Initial Email)" : " (Follow-up)"}\n`;

    for (const variant of variants) {
      const isBest = bestPerStep.get(stepNum)?.variant === variant.variant;
      content += `\n**Variant ${variant.variant}${isBest ? " - TOP PERFORMER" : ""}**\n`;
      content += `Subject: ${variant.subject || "(No subject)"}\n`;
      content += `\n${stripHtml(variant.body_html) || variant.body_text || "(No body)"}\n`;
    }
  }

  // Clear instruction to generate variations
  content += `
---

## Generate 5 New Variations

Create 5 new email variations for Step 1 (initial outreach). For each variation:

1. **Analyze** what makes the top-performing variant work (tone, structure, hooks, CTA)
2. **Keep** the personalization variables: {{firstName}}, {{companyName}}, {{1st line}}
3. **Test different approaches:**
   - Different subject line angles
   - Different opening hooks
   - Different value prop framing
   - Different CTAs
4. **Stay concise:** 50-125 words max

### Output Format

For each of the 5 variations, provide:

**VARIATION 1**
Subject: [subject line]

[email body]

*Testing: [what this variation tests differently]*

---

**VARIATION 2**
...and so on for all 5 variations.

## Go ahead and generate the 5 variations now.
`;

  return content;
}
