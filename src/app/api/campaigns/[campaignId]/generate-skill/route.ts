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

interface SequenceData {
  step_number: number;
  variant: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  delay_days: number;
}

// Fetch sequences directly from Smartlead API
async function fetchSmartleadSequences(
  apiKey: string,
  providerCampaignId: string
): Promise<SequenceData[]> {
  const baseUrl = "https://server.smartlead.ai/api/v1";

  const seqRes = await fetch(
    `${baseUrl}/campaigns/${providerCampaignId}/sequences?api_key=${apiKey}`
  );
  const seqData = await seqRes.json();

  const sequences: SequenceData[] = [];
  const steps = Array.isArray(seqData)
    ? seqData
    : seqData.email_campaign_sequences || [];

  for (const step of steps) {
    const stepNumber = step.seq_number || step.sequence_number || 1;
    const variants = step.sequence_variants || step.seq_variants || [];

    for (const variant of variants) {
      const variantLabel = variant.variant_label || "A";
      sequences.push({
        step_number: stepNumber,
        variant: variantLabel,
        subject: variant.subject || step.subject || null,
        body_text: null,
        body_html: variant.email_body || step.email_body || null,
        delay_days: step.seq_delay_details?.delay_in_days || 0,
      });
    }
  }

  return sequences;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // 1. Fetch campaign details including API key for Smartlead
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, original_name, provider_type, provider_campaign_id, client_id, api_key_encrypted")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // 2. Fetch client details
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, product_service, verticals, icp, acv, tcv, tam, website, notes")
      .eq("id", campaign.client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 3. Fetch email sequences from local DB first
    let sequences: SequenceData[] = [];
    const { data: localSequences } = await supabase
      .from("campaign_sequences")
      .select("step_number, variant, subject, body_text, body_html, delay_days")
      .eq("campaign_id", campaignId)
      .order("step_number", { ascending: true })
      .order("variant", { ascending: true });

    if (localSequences && localSequences.length > 0) {
      sequences = localSequences;
    } else if (
      campaign.provider_type === "smartlead" &&
      campaign.api_key_encrypted &&
      campaign.provider_campaign_id
    ) {
      // Fetch sequences directly from Smartlead API if not synced locally
      try {
        sequences = await fetchSmartleadSequences(
          campaign.api_key_encrypted,
          campaign.provider_campaign_id
        );
      } catch (err) {
        console.error("[GenerateSkill] Error fetching Smartlead sequences:", err);
      }
    }

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
    const skillContent = generateSkillFile(campaign, client, sequences, performanceData, bestPerStep);

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
  campaign: {
    name: string;
    original_name: string | null;
    provider_type: string | null;
    provider_campaign_id: string | null;
    api_key_encrypted: string | null;
  },
  client: {
    name: string;
    product_service: string | null;
    verticals: string[] | null;
    icp: string | null;
    acv: number | null;
    tcv: number | null;
    tam: number | null;
    website: string | null;
    notes: string | null;
  },
  sequences: SequenceData[],
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
${client.website ? `Website: ${client.website}` : ""}

**What they sell:** ${client.product_service || "Not specified"}

**Target audience:** ${client.icp || "Not specified"}

**Industries:** ${client.verticals && client.verticals.length > 0 ? client.verticals.join(", ") : "Not specified"}

${client.acv ? `**Deal size:** $${client.acv.toLocaleString()} ACV` : ""}

${client.notes ? `**Notes:** ${client.notes}` : ""}

---

## Performance Data (What's Working)
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

  // Instruction to ask clarifying questions first
  content += `
---

## Available Personalization Variables
- {{firstName}} - Lead's first name
- {{lastName}} - Lead's last name
- {{companyName}} - Lead's company
- {{1st line}} - Custom personalization/icebreaker

---

## A/B Testing Best Practices (From Industry Experts)

The following frameworks come from Eric Nowoslawski (Growth Engine X, 1.5M+ emails/month) and Nick Abraham (10M+ cold emails):

### Email Structure Options
- **Trigger → Problem → Proof → Soft CTA** (Eric's framework): Open with observable trigger (hiring, funding, traffic), connect to business problem, share specific proof point with metrics, soft ask
- **Problem → Value → Social Proof → CTA** (Classic): Lead with pain point, present solution value, back with proof, call to action
- **Personalized Observation → Insight → Offer** (Nick's approach): Hyper-personalized opener, unique insight they haven't heard, specific offer

### Length Guidelines
- **Ultra-short (<75 words)** - Nick Abraham's recommendation for maximum conversions
- **Short (<100 words)** - Eric Nowoslawski's standard, "write like a human"
- **Medium (100-125 words)** - When more context/proof is needed

### CTA Philosophy
- **Never ask for a call** (Nick): "We're simply asking to show them how we did something they should care about"
- **Micro-CTA** (Eric): "Want the video?" / "Should I send the teardown?" / "If I map this for two reps first, want it?"
- **Value-first offer**: Offer audit, video breakdown, ROI model, or playbook before asking for time

### What to Test (One Element Per Variant)
- **Subject lines**: Curiosity vs clarity, question vs statement, personalized vs generic
- **Opening hook**: Trigger-based vs problem-based vs compliment-based
- **Proof format**: Specific metrics vs client names vs industry results
- **CTA style**: Question vs statement, specific vs open-ended
- **Tone**: Casual/conversational vs professional vs provocative
- **Length**: Test shorter vs current length

### Copy Refresh Strategy (After 1 Month)
When copy fatigues, keep the core offer but completely change structure and format. Each refresh should "read totally differently but not compromise the original offer."

---

## Your Instructions

Now that you've reviewed the campaign context, performance data, and best practices:

1. **Ask me 5-7 clarifying multiple choice questions** to understand what I want to optimize. Include your recommendation for each. Questions should cover:

   **Required questions:**
   - Which email step to focus on
   - Which structure framework to follow (Trigger→Problem→Proof→CTA, Problem→Value→Proof→CTA, or Personalized Observation→Insight→Offer)
   - Target length (<75 words, <100 words, or 100-125 words)
   - CTA style (never ask for call + offer value, micro-CTA question, or direct meeting ask)

   **Optional questions based on context:**
   - What single element to A/B test across variants
   - Tone direction
   - Whether this is a refresh of existing copy or new angles
   - Specific pain point or trigger to emphasize

2. **Wait for my answers** before generating copy

3. **After I answer**, provide 5 email variations that:
   - Follow the chosen framework structure
   - Respect the length limit chosen
   - Use the CTA style selected
   - Each variant tests ONE different element (document what each tests)
   - Build on what's working in the top-performing variants
   - Keep the personalization variables

4. **Label each variant** with what it's testing:
   \`\`\`
   Variant A: Control (based on top performer)
   Variant B: Testing [specific element]
   Variant C: Testing [specific element]
   etc.
   \`\`\`

**Start by asking your clarifying questions now.**
`;

  return content;
}
