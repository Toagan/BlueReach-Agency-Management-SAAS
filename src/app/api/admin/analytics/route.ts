import { NextRequest, NextResponse } from "next/server";
import { getCampaignAnalytics, getCampaignDailyAnalytics } from "@/lib/instantly";

// Helper to get date range based on period
function getDateRange(period: string): { startDate: Date; endDate: Date } {
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
      // Default to this week
      startDate = new Date(now);
      const defaultDay = startDate.getDay();
      const defaultDiff = startDate.getDate() - defaultDay + (defaultDay === 0 ? -6 : 1);
      startDate.setDate(defaultDiff);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// GET - Get analytics with date filtering using Instantly's daily analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "this_week";

    const { startDate, endDate } = getDateRange(period);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Fetch daily analytics from Instantly with date range
    // AND cumulative analytics for metrics not available in daily
    const [dailyAnalytics, cumulativeAnalytics] = await Promise.all([
      getCampaignDailyAnalytics({
        start_date: startDateStr,
        end_date: endDateStr,
      }),
      getCampaignAnalytics(),
    ]);

    // Sum up daily metrics (these are filtered by date range)
    let emailsSent = 0;
    let emailsOpened = 0;
    let replies = 0;
    let newLeadsContacted = 0;
    let dailyOpportunities = 0;

    dailyAnalytics.forEach((day) => {
      emailsSent += day.sent || 0;
      emailsOpened += day.unique_opened || 0;
      replies += day.unique_replies || 0;
      newLeadsContacted += day.new_leads_contacted || 0;
      dailyOpportunities += day.unique_opportunities || 0;
    });

    // Get cumulative metrics (these are totals, not filtered by date)
    // Note: bounced, meetings, deals are ONLY available as cumulative from Instantly
    let totalBounced = 0;
    let totalMeetingsHeld = 0;
    let totalDealsClosed = 0;

    cumulativeAnalytics.forEach((a) => {
      totalBounced += a.bounced_count || 0;
      totalMeetingsHeld += a.total_meeting_completed || 0;
      totalDealsClosed += a.total_closed || 0;
    });

    // Calculate reply rate based on the period's emails
    const replyRate = emailsSent > 0 ? (replies / emailsSent) * 100 : 0;

    // Determine if we got daily data (indicates time filtering worked)
    const hasDailyData = dailyAnalytics.length > 0;

    return NextResponse.json({
      source: "instantly",
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      // Time-filtered metrics (from daily analytics)
      leads_contacted: newLeadsContacted,  // NEW leads contacted in this period
      emails_sent: emailsSent,
      emails_opened: emailsOpened,
      replies,
      opportunities: dailyOpportunities,   // Positive replies in this period
      // Cumulative metrics (totals - Instantly doesn't provide daily breakdown for these)
      bounced_cumulative: totalBounced,
      meetings_held_cumulative: totalMeetingsHeld,
      deals_closed_cumulative: totalDealsClosed,
      // Calculated
      reply_rate: Number(replyRate.toFixed(2)),
      // Metadata
      has_baseline: hasDailyData,
      daily_data_points: dailyAnalytics.length,
      note: hasDailyData
        ? `Showing ${period.replace("_", " ")} activity. Bounced/Meetings/Deals are all-time totals (not filtered).`
        : "No daily data available for this period.",
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
