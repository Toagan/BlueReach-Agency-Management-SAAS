import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

// GET - Get analytics from LOCAL Supabase database
// For date-filtered periods, uses campaign_analytics_daily table (accurate daily snapshots)
// For all-time, uses campaigns.cached_* fields (aggregated totals from Instantly API)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all_time";

    const supabase = getSupabase();
    const dateRange = getDateRange(period);

    let emailsSent = 0;
    let emailsOpened = 0;
    let emailsClicked = 0;
    let replies = 0;
    let opportunities = 0;
    let leadsContacted = 0;
    let bounced = 0;
    let dataSource = "campaigns_cached";

    if (dateRange) {
      // DATE-FILTERED: Use campaign_analytics_daily table for accurate date-based metrics
      const startDateStr = dateRange.startDate.toISOString().split("T")[0];
      const endDateStr = dateRange.endDate.toISOString().split("T")[0];

      const { data: dailyStats, error: dailyError } = await supabase
        .from("campaign_analytics_daily")
        .select("emails_sent, emails_opened, emails_clicked, emails_replied, positive_replies, leads_contacted")
        .gte("snapshot_date", startDateStr)
        .lte("snapshot_date", endDateStr);

      if (dailyError) {
        console.error("Error fetching daily analytics:", dailyError);
        // Fall back to leads count if daily snapshots not available
        const { count: leadsCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());

        const { count: repliesCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("has_replied", true)
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());

        const { count: positiveCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("is_positive_reply", true)
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());

        leadsContacted = leadsCount || 0;
        emailsSent = leadsContacted; // Fallback proxy
        replies = repliesCount || 0;
        opportunities = positiveCount || 0;
        dataSource = "leads_fallback";
      } else if (dailyStats && dailyStats.length > 0) {
        // Aggregate daily stats
        emailsSent = dailyStats.reduce((sum, d) => sum + (d.emails_sent || 0), 0);
        emailsOpened = dailyStats.reduce((sum, d) => sum + (d.emails_opened || 0), 0);
        emailsClicked = dailyStats.reduce((sum, d) => sum + (d.emails_clicked || 0), 0);
        replies = dailyStats.reduce((sum, d) => sum + (d.emails_replied || 0), 0);
        opportunities = dailyStats.reduce((sum, d) => sum + (d.positive_replies || 0), 0);
        leadsContacted = dailyStats.reduce((sum, d) => sum + (d.leads_contacted || 0), 0);
        dataSource = "daily_snapshots";
      } else {
        // No daily data for this period - fall back to leads count
        const { count: leadsCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());

        const { count: repliesCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("has_replied", true)
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());

        const { count: positiveCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("is_positive_reply", true)
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());

        leadsContacted = leadsCount || 0;
        emailsSent = leadsContacted; // Fallback proxy
        replies = repliesCount || 0;
        opportunities = positiveCount || 0;
        dataSource = "leads_fallback";
      }
    } else {
      // ALL-TIME: Use campaigns.cached_* for accurate totals
      const [leadsResult, repliesResult, positiveResult, emailsResult, bouncedResult] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("has_replied", true),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("is_positive_reply", true),
        supabase.from("campaigns").select("cached_emails_sent, cached_emails_opened"),
        supabase.from("campaigns").select("cached_emails_bounced"),
      ]);

      leadsContacted = leadsResult.count || 0;
      replies = repliesResult.count || 0;
      opportunities = positiveResult.count || 0;

      if (emailsResult.data) {
        emailsSent = emailsResult.data.reduce(
          (sum: number, c: { cached_emails_sent: number | null }) => sum + (c.cached_emails_sent || 0),
          0
        );
        emailsOpened = emailsResult.data.reduce(
          (sum: number, c: { cached_emails_opened: number | null }) => sum + (c.cached_emails_opened || 0),
          0
        );
      }
      if (bouncedResult.data) {
        bounced = bouncedResult.data.reduce(
          (sum: number, c: { cached_emails_bounced: number | null }) => sum + (c.cached_emails_bounced || 0),
          0
        );
      }
      dataSource = "campaigns_cached";
    }

    // Calculate reply rate based on emails sent (or leads contacted as fallback)
    const baseForRate = emailsSent > 0 ? emailsSent : leadsContacted;
    const replyRate = baseForRate > 0 ? (replies / baseForRate) * 100 : 0;

    return NextResponse.json({
      period,
      start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
      end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
      leads_contacted: leadsContacted,
      emails_sent: emailsSent,
      emails_opened: emailsOpened,
      emails_clicked: emailsClicked,
      bounced,
      replies,
      opportunities,
      reply_rate: Number(replyRate.toFixed(2)),
      data_source: dataSource,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
