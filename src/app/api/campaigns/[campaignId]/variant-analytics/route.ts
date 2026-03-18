// Variant Analytics API
// Returns performance metrics broken down by email sequence step and variant (A/B/C)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCampaignAccess } from "@/lib/auth";

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

// Fetch sent counts per variant from Smartlead API with parallel requests
async function fetchSmartleadSentCounts(
  apiKey: string,
  providerCampaignId: string
): Promise<Map<string, { step: number; variant: string; variantId: number; sent: number }>> {
  const baseUrl = "https://server.smartlead.ai/api/v1";

  // First get variant mapping (variant ID -> label) and total count
  const [seqRes, analyticsRes] = await Promise.all([
    fetch(`${baseUrl}/campaigns/${providerCampaignId}/sequences?api_key=${apiKey}`),
    fetch(`${baseUrl}/campaigns/${providerCampaignId}/analytics?api_key=${apiKey}`),
  ]);

  const seqData = await seqRes.json();
  const analytics = await analyticsRes.json();
  const totalSent = parseInt(analytics.sent_count) || 0;

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

  // Fetch statistics with parallel requests (batches of 10 pages at a time)
  const allStats: Array<{ sequence_number: number; seq_variant_id: number }> = [];
  const limit = 500; // Try higher limit for fewer requests
  const totalPages = Math.ceil(totalSent / limit);
  const batchSize = 10; // Fetch 10 pages in parallel

  for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalPages);
    const pagePromises = [];

    for (let page = batchStart; page < batchEnd; page++) {
      const offset = page * limit;
      pagePromises.push(
        fetch(`${baseUrl}/campaigns/${providerCampaignId}/statistics?api_key=${apiKey}&limit=${limit}&offset=${offset}`)
          .then(res => res.json())
          .then(data => data.data || [])
          .catch(() => [])
      );
    }

    const batchResults = await Promise.all(pagePromises);
    for (const pageData of batchResults) {
      allStats.push(...pageData);
    }

    // Small delay between batches to respect rate limits
    if (batchStart + batchSize < totalPages) {
      await new Promise(resolve => setTimeout(resolve, 500));
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

// Cache duration in hours
const CACHE_DURATION_HOURS = 24;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;
  const supabase = getSupabase();

  // Check for force refresh query param
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  try {
    // Get campaign info including API key and cached stats
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, provider_type, provider_campaign_id, api_key_encrypted, cached_variant_stats, variant_stats_updated_at")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if we have valid cached data (less than CACHE_DURATION_HOURS old)
    const cacheAge = campaign.variant_stats_updated_at
      ? (Date.now() - new Date(campaign.variant_stats_updated_at).getTime()) / (1000 * 60 * 60)
      : Infinity;

    const hasFreshCache = !forceRefresh &&
      campaign.cached_variant_stats &&
      cacheAge < CACHE_DURATION_HOURS;

    // Initialize variant map - either from cache or fresh fetch
    const variantMap = new Map<string, {
      step: number;
      variant: string;
      variantId: number | null;
      sent: number;
      replies: number;
      positiveReplies: number;
    }>();

    let usedCache = false;

    // For Smartlead campaigns, use cache or fetch from API
    if (campaign.provider_type === "smartlead" && campaign.api_key_encrypted && campaign.provider_campaign_id) {
      if (hasFreshCache && campaign.cached_variant_stats) {
        // Use cached sent counts
        console.log(`[VariantAnalytics] Using cached data (${cacheAge.toFixed(1)}h old)`);
        const cachedData = campaign.cached_variant_stats as Array<{
          step: number;
          variant: string;
          variantId: number;
          sent: number;
        }>;

        for (const data of cachedData) {
          const key = `${data.step}-${data.variant}`;
          variantMap.set(key, {
            step: data.step,
            variant: data.variant,
            variantId: data.variantId,
            sent: data.sent,
            replies: 0,
            positiveReplies: 0,
          });
        }
        usedCache = true;
      } else {
        // Fetch fresh data from Smartlead API
        console.log(`[VariantAnalytics] Fetching fresh data from Smartlead API`);
        try {
          const smartleadSentCounts = await fetchSmartleadSentCounts(
            campaign.api_key_encrypted,
            campaign.provider_campaign_id
          );

          // Add sent counts to variant map
          const cacheData: Array<{ step: number; variant: string; variantId: number; sent: number }> = [];

          for (const [key, data] of smartleadSentCounts) {
            variantMap.set(key, {
              step: data.step,
              variant: data.variant,
              variantId: data.variantId,
              sent: data.sent,
              replies: 0,
              positiveReplies: 0,
            });
            cacheData.push({
              step: data.step,
              variant: data.variant,
              variantId: data.variantId,
              sent: data.sent,
            });
          }

          // Store in cache (don't await to avoid slowing response)
          supabase
            .from("campaigns")
            .update({
              cached_variant_stats: cacheData,
              variant_stats_updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId)
            .then(({ error }) => {
              if (error) {
                console.error("[VariantAnalytics] Error caching stats:", error);
              } else {
                console.log("[VariantAnalytics] Cached variant stats for campaign", campaignId);
              }
            });
        } catch (err) {
          console.error("[VariantAnalytics] Error fetching Smartlead sent counts:", err);
        }
      }
    } else {
      // For Instantly or when Smartlead API not available, use lead_emails table
      // Paginate to avoid Supabase's default 1000 row limit
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: emailStats, error: emailError } = await supabase
          .from("lead_emails")
          .select("sequence_step, sequence_variant, sequence_variant_label")
          .eq("campaign_id", campaignId)
          .eq("direction", "outbound")
          .not("sequence_step", "is", null)
          .range(offset, offset + pageSize - 1);

        if (emailError) {
          console.error("[VariantAnalytics] Error fetching email stats:", emailError);
          break;
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

        hasMore = (emailStats?.length || 0) === pageSize;
        offset += pageSize;
      }
    }

    // Query reply tracking from leads table (works for both providers)
    // Use email_reply_count > 0 OR is_positive_reply = true as reliable reply indicators
    // Note: has_replied may include false positives from "completed" status
    const { data: leadStats, error: leadError } = await supabase
      .from("leads")
      .select("id, reply_from_step, reply_from_variant, reply_from_variant_label, is_positive_reply, email_reply_count")
      .eq("campaign_id", campaignId)
      .or("email_reply_count.gt.0,is_positive_reply.eq.true");

    if (leadError) {
      console.error("[VariantAnalytics] Error fetching lead stats:", leadError);
    }

    // For leads without reply_from_step, try to infer variant from their outbound emails
    const untrackedLeadIds = (leadStats || [])
      .filter((lead) => lead.reply_from_step === null)
      .map((lead) => lead.id);

    const outboundEmailMap = new Map<string, { step: number; variantId: number | null; variantLabel: string }>();

    if (untrackedLeadIds.length > 0) {
      // Fetch the most recent outbound email for each untracked lead
      const { data: outboundEmails } = await supabase
        .from("lead_emails")
        .select("lead_id, sequence_step, sequence_variant, sequence_variant_label, sent_at")
        .eq("campaign_id", campaignId)
        .eq("direction", "outbound")
        .in("lead_id", untrackedLeadIds)
        .not("sequence_step", "is", null)
        .order("sent_at", { ascending: false });

      // Keep only the most recent outbound email per lead
      for (const email of outboundEmails || []) {
        if (!outboundEmailMap.has(email.lead_id)) {
          outboundEmailMap.set(email.lead_id, {
            step: email.sequence_step,
            variantId: email.sequence_variant,
            variantLabel: email.sequence_variant_label || "Unknown",
          });
        }
      }
    }

    // Count replies and positive replies per step/variant
    // Also track untracked replies (those without reply_from_step and no outbound email match)
    let untrackedReplies = 0;
    let untrackedPositiveReplies = 0;

    (leadStats || []).forEach((lead) => {
      let step = lead.reply_from_step;
      let variant = lead.reply_from_variant_label || "Unknown";
      let variantId = lead.reply_from_variant;

      if (step === null) {
        // Try to infer from outbound emails
        const outbound = outboundEmailMap.get(lead.id);
        if (outbound) {
          step = outbound.step;
          variantId = outbound.variantId;
          variant = outbound.variantLabel;
        } else {
          // No outbound email found — truly untracked
          untrackedReplies++;
          if (lead.is_positive_reply) {
            untrackedPositiveReplies++;
          }
          return;
        }
      }

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

    // Calculate totals (tracked variants only)
    const trackedReplies = variants.reduce((sum, v) => sum + v.replies, 0);
    const trackedPositiveReplies = variants.reduce((sum, v) => sum + v.positiveReplies, 0);

    const totals = {
      totalEmailsSent: variants.reduce((sum, v) => sum + v.emailsSent, 0),
      totalReplies: trackedReplies,
      totalPositiveReplies: trackedPositiveReplies,
      // Include untracked counts so UI can show the full picture
      untrackedReplies,
      untrackedPositiveReplies,
      // Grand totals including untracked
      allReplies: trackedReplies + untrackedReplies,
      allPositiveReplies: trackedPositiveReplies + untrackedPositiveReplies,
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
