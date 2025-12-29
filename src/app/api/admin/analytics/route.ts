import { NextRequest, NextResponse } from "next/server";
import { getCampaignDailyAnalytics } from "@/lib/instantly";

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
    const dailyAnalytics = await getCampaignDailyAnalytics({
      start_date: startDateStr,
      end_date: endDateStr,
    });

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

    // Calculate reply rate based on the period's emails
    const replyRate = emailsSent > 0 ? (replies / emailsSent) * 100 : 0;

    return NextResponse.json({
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      leads_contacted: newLeadsContacted,
      emails_sent: emailsSent,
      emails_opened: emailsOpened,
      replies,
      opportunities: dailyOpportunities,
      reply_rate: Number(replyRate.toFixed(2)),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
