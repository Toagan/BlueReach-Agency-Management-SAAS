// Variant Analytics API
// Returns performance metrics broken down by email sequence step and variant (A/B/C)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface VariantStats {
  step: number;
  variant: string;
  variantId: number | null;
  emailsSent: number;
  replies: number;
  positiveReplies: number;
  replyRate: number;
  positiveReplyRate: number;
}

interface VariantAnalyticsResponse {
  campaignId: string;
  campaignName: string;
  providerType: string;
  variants: VariantStats[];
  winner: {
    step: number;
    variant: string;
    metric: string;
    value: number;
  } | null;
  totals: {
    totalEmailsSent: number;
    totalReplies: number;
    totalPositiveReplies: number;
    overallReplyRate: number;
    overallPositiveRate: number;
  };
}

// Fetch sent counts per variant from Smartlead API
async function fetchSmartleadSentCounts(
  apiKey: string,
  providerCampaignId: string
): Promise<Map<string, { step: number; variant: string; variantId: number; sent: number }>> {
  const baseUrl = "https://server.smartlead.ai/api/v1";

  // First get variant mapping (variant ID -> label)
  const seqRes = await fetch(`${baseUrl}/campaigns/${providerCampaignId}/sequences?api_key=${apiKey}`);
  const seqData = await seqRes.json();

  const variantMap = new Map<number, { label: string; stepNumber: number }>();
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

  // Fetch all statistics with pagination
  const allStats: Array<{ sequence_number: number; seq_variant_id: number }> = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const statsRes = await fetch(
      `${baseUrl}/campaigns/${providerCampaignId}/statistics?api_key=${apiKey}&limit=${limit}&offset=${offset}`
    );
    const statsData = await statsRes.json();

    if (!statsData.data || statsData.data.length === 0) {
      hasMore = false;
    } else {
      allStats.push(...statsData.data);
      offset += limit;
      hasMore = statsData.data.length === limit;
    }
  }

  // Count sent emails per step/variant
  const sentCounts = new Map<string, { step: number; variant: string; variantId: number; sent: number }>();

  for (const stat of allStats) {
    const stepNumber = stat.sequence_number;
    const variantId = stat.seq_variant_id;

    if (!stepNumber || !variantId) continue;

    const variantInfo = variantMap.get(variantId);
    const variantLabel = variantInfo?.label || `Unknown`;

    const key = `${stepNumber}-${variantLabel}`;

    if (!sentCounts.has(key)) {
      sentCounts.set(key, {
        step: stepNumber,
        variant: variantLabel,
        variantId: variantId,
        sent: 0,
      });
    }

    sentCounts.get(key)!.sent++;
  }

  return sentCounts;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // Get campaign info including API key for Smartlead
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, provider_type, provider_campaign_id, api_key_encrypted")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Initialize variant map
    const variantMap = new Map<string, {
      step: number;
      variant: string;
      variantId: number | null;
      sent: number;
      replies: number;
      positiveReplies: number;
    }>();

    // For Smartlead campaigns, fetch sent counts from API
    if (campaign.provider_type === "smartlead" && campaign.api_key_encrypted && campaign.provider_campaign_id) {
      try {
        const smartleadSentCounts = await fetchSmartleadSentCounts(
          campaign.api_key_encrypted,
          campaign.provider_campaign_id
        );

        // Add sent counts to variant map
        for (const [key, data] of smartleadSentCounts) {
          variantMap.set(key, {
            step: data.step,
            variant: data.variant,
            variantId: data.variantId,
            sent: data.sent,
            replies: 0,
            positiveReplies: 0,
          });
        }
      } catch (err) {
        console.error("[VariantAnalytics] Error fetching Smartlead sent counts:", err);
      }
    } else {
      // For Instantly or when Smartlead API not available, use lead_emails table
      const { data: emailStats, error: emailError } = await supabase
        .from("lead_emails")
        .select("sequence_step, sequence_variant, sequence_variant_label")
        .eq("campaign_id", campaignId)
        .eq("direction", "outbound")
        .not("sequence_step", "is", null);

      if (emailError) {
        console.error("[VariantAnalytics] Error fetching email stats:", emailError);
      }

      // Count emails sent per step/variant
      (emailStats || []).forEach((email) => {
        if (email.sequence_step === null) return;

        const step = email.sequence_step;
        const variant = email.sequence_variant_label || "Unknown";
        const variantId = email.sequence_variant;
        const key = `${step}-${variant}`;

        const existing = variantMap.get(key);
        if (existing) {
          existing.sent++;
        } else {
          variantMap.set(key, {
            step,
            variant,
            variantId,
            sent: 1,
            replies: 0,
            positiveReplies: 0,
          });
        }
      });
    }

    // Query reply tracking from leads table (works for both providers)
    const { data: leadStats, error: leadError } = await supabase
      .from("leads")
      .select("reply_from_step, reply_from_variant, reply_from_variant_label, is_positive_reply, has_replied")
      .eq("campaign_id", campaignId)
      .eq("has_replied", true);

    if (leadError) {
      console.error("[VariantAnalytics] Error fetching lead stats:", leadError);
    }

    // Count replies and positive replies per step/variant
    (leadStats || []).forEach((lead) => {
      if (lead.reply_from_step === null) return;

      const step = lead.reply_from_step;
      const variant = lead.reply_from_variant_label || "Unknown";
      const variantId = lead.reply_from_variant;
      const key = `${step}-${variant}`;

      let stats = variantMap.get(key);
      if (!stats) {
        // Lead has reply info but we don't have sent stats - create entry
        stats = {
          step,
          variant,
          variantId,
          sent: 0,
          replies: 0,
          positiveReplies: 0,
        };
        variantMap.set(key, stats);
      }

      stats.replies++;
      if (lead.is_positive_reply) {
        stats.positiveReplies++;
      }
    });

    // Convert to array and calculate rates
    const variants: VariantStats[] = Array.from(variantMap.values())
      .map((stats) => ({
        step: stats.step,
        variant: stats.variant,
        variantId: stats.variantId,
        emailsSent: stats.sent,
        replies: stats.replies,
        positiveReplies: stats.positiveReplies,
        replyRate: stats.sent > 0 ? Number(((stats.replies / stats.sent) * 100).toFixed(2)) : 0,
        positiveReplyRate: stats.sent > 0 ? Number(((stats.positiveReplies / stats.sent) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => {
        // Sort by step, then by positive replies (descending)
        if (a.step !== b.step) return a.step - b.step;
        return b.positiveReplies - a.positiveReplies;
      });

    // Calculate totals
    const totals = {
      totalEmailsSent: variants.reduce((sum, v) => sum + v.emailsSent, 0),
      totalReplies: variants.reduce((sum, v) => sum + v.replies, 0),
      totalPositiveReplies: variants.reduce((sum, v) => sum + v.positiveReplies, 0),
      overallReplyRate: 0,
      overallPositiveRate: 0,
    };

    if (totals.totalEmailsSent > 0) {
      totals.overallReplyRate = Number(((totals.totalReplies / totals.totalEmailsSent) * 100).toFixed(2));
      totals.overallPositiveRate = Number(((totals.totalPositiveReplies / totals.totalEmailsSent) * 100).toFixed(2));
    }

    // Find winner (highest positive reply rate with minimum 100 emails sent)
    let winner: VariantAnalyticsResponse["winner"] = null;
    const eligibleVariants = variants.filter((v) => v.emailsSent >= 100);

    if (eligibleVariants.length > 0) {
      const bestVariant = eligibleVariants.reduce((best, current) => {
        return current.positiveReplyRate > best.positiveReplyRate ? current : best;
      });

      if (bestVariant.positiveReplyRate > 0) {
        winner = {
          step: bestVariant.step,
          variant: bestVariant.variant,
          metric: "positiveReplyRate",
          value: bestVariant.positiveReplyRate,
        };
      }
    }

    const response: VariantAnalyticsResponse = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      providerType: campaign.provider_type || "unknown",
      variants,
      winner,
      totals,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[VariantAnalytics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch variant analytics" },
      { status: 500 }
    );
  }
}
