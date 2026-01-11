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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // Get campaign info
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, provider_type")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Query 1: Get emails sent by step/variant from lead_emails
    const { data: emailStats, error: emailError } = await supabase
      .from("lead_emails")
      .select("sequence_step, sequence_variant, sequence_variant_label")
      .eq("campaign_id", campaignId)
      .eq("direction", "outbound")
      .not("sequence_step", "is", null);

    if (emailError) {
      console.error("[VariantAnalytics] Error fetching email stats:", emailError);
    }

    // Query 2: Get reply tracking from leads table
    const { data: leadStats, error: leadError } = await supabase
      .from("leads")
      .select("reply_from_step, reply_from_variant, reply_from_variant_label, is_positive_reply, has_replied")
      .eq("campaign_id", campaignId)
      .eq("has_replied", true);

    if (leadError) {
      console.error("[VariantAnalytics] Error fetching lead stats:", leadError);
    }

    // Aggregate stats by step + variant
    const variantMap = new Map<string, {
      step: number;
      variant: string;
      variantId: number | null;
      sent: number;
      replies: number;
      positiveReplies: number;
    }>();

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
        // Sort by step, then by variant
        if (a.step !== b.step) return a.step - b.step;
        return a.variant.localeCompare(b.variant);
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

    // Find winner (highest positive reply rate with minimum 10 emails sent)
    let winner: VariantAnalyticsResponse["winner"] = null;
    const eligibleVariants = variants.filter((v) => v.emailsSent >= 10);

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
