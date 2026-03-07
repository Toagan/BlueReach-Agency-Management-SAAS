import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to get date range based on period
function getDateRange(period: string): { startDate: Date; endDate: Date } | null {
  if (period === "all_time") {
    return null; // No date filtering
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (period) {
    case "this_week": {
      // Start of current week (Monday)
      startDate = new Date(now);
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month": {
      // Start of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "this_quarter": {
      // Start of current quarter
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    default:
      return null; // Default to all time
  }

  return { startDate, endDate };
}

// GET - Get analytics from Supabase (provider-agnostic)
// Uses leads + lead_emails tables as single source of truth for all periods
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all_time";

    const supabase = getSupabase();
    const dateRange = getDateRange(period);

    // Get effective owner's campaign IDs for scoping (always scoped)
    const ownerId = await getEffectiveOwnerId(auth);
    const { data: ownerClients } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_id", ownerId);
    const clientIds = ownerClients?.map(c => c.id) || [];

    if (clientIds.length === 0) {
      return NextResponse.json({
        period,
        start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
        end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
        leads_contacted: 0, emails_sent: 0, emails_opened: 0, emails_clicked: 0,
        bounced: 0, replies: 0, opportunities: 0, reply_rate: 0, data_source: "empty",
      });
    }

    const { data: ownerCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .in("client_id", clientIds);
    const ownerCampaignIds = ownerCampaigns?.map(c => c.id) || [];

    if (ownerCampaignIds.length === 0) {
      return NextResponse.json({
        period,
        start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
        end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
        leads_contacted: 0, emails_sent: 0, emails_opened: 0, emails_clicked: 0,
        bounced: 0, replies: 0, opportunities: 0, reply_rate: 0, data_source: "empty",
      });
    }

    // All analytics sourced from Supabase — provider-agnostic
    const startIso = dateRange?.startDate.toISOString();
    const endIso = dateRange?.endDate.toISOString();

    // Build all queries in parallel
    // 1. Total leads (contacted)
    let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true })
      .in("campaign_id", ownerCampaignIds);
    // 2. Replies
    let repliesQuery = supabase.from("leads").select("*", { count: "exact", head: true })
      .in("campaign_id", ownerCampaignIds)
      .eq("has_replied", true);
    // 3. Positive replies
    let positiveQuery = supabase.from("leads").select("*", { count: "exact", head: true })
      .in("campaign_id", ownerCampaignIds)
      .eq("is_positive_reply", true);

    // Apply date filters if not all-time
    if (startIso && endIso) {
      leadsQuery = leadsQuery.gte("created_at", startIso).lte("created_at", endIso);
      repliesQuery = repliesQuery.gte("responded_at", startIso).lte("responded_at", endIso);
      positiveQuery = positiveQuery.gte("updated_at", startIso).lte("updated_at", endIso);
    }

    // For emails sent: use cached_emails_sent from campaigns (accurate total from provider APIs)
    // For date-filtered periods, fall back to lead_emails table
    let emailsSentPromise: PromiseLike<number>;
    if (!startIso) {
      // All time: sum cached_emails_sent from campaigns (this is the accurate count from providers)
      emailsSentPromise = supabase
        .from("campaigns")
        .select("cached_emails_sent")
        .in("id", ownerCampaignIds)
        .then(({ data }) => {
          return (data || []).reduce((sum: number, c: { cached_emails_sent: number | null }) =>
            sum + (c.cached_emails_sent || 0), 0);
        });
    } else {
      // Date-filtered: count from lead_emails (only partially populated, but best we have for date ranges)
      emailsSentPromise = supabase
        .from("lead_emails")
        .select("*", { count: "exact", head: true })
        .in("campaign_id", ownerCampaignIds)
        .eq("direction", "outbound")
        .gte("sent_at", startIso)
        .lte("sent_at", endIso)
        .then(({ count }) => count || 0);
    }

    const [leadsResult, repliesResult, positiveResult, emailsSent] = await Promise.all([
      leadsQuery, repliesQuery, positiveQuery, emailsSentPromise,
    ]);

    const leadsContacted = leadsResult.count || 0;
    const replies = repliesResult.count || 0;
    const opportunities = positiveResult.count || 0;

    // Calculate reply rate based on emails sent (or leads contacted as fallback)
    const baseForRate = emailsSent > 0 ? emailsSent : leadsContacted;
    const replyRate = baseForRate > 0 ? (replies / baseForRate) * 100 : 0;

    return NextResponse.json({
      period,
      start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
      end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
      leads_contacted: leadsContacted,
      emails_sent: emailsSent,
      emails_opened: 0,
      emails_clicked: 0,
      bounced: 0,
      replies,
      opportunities,
      reply_rate: Number(replyRate.toFixed(2)),
      data_source: "supabase",
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
