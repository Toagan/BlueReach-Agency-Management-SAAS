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

// GET - Get analytics from LOCAL Supabase database only
// This ensures stats are preserved even after deleting from Instantly
// All data comes from synced leads table - the source of truth
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all_time";

    const supabase = getSupabase();
    const dateRange = getDateRange(period);

    // Build queries from LOCAL leads table (not Instantly API)
    // This is the source of truth for all historical data

    // Total leads contacted (all synced leads)
    let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true });

    // Replies (leads who replied)
    let repliesQuery = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("has_replied", true);

    // Positive replies
    let positiveQuery = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("is_positive_reply", true);

    // Emails sent - count from lead_emails table for accuracy
    let emailsQuery = supabase
      .from("lead_emails")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound");

    // Apply date filter if not all_time
    if (dateRange) {
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = dateRange.endDate.toISOString();

      leadsQuery = leadsQuery.gte("created_at", startDateStr).lte("created_at", endDateStr);
      repliesQuery = repliesQuery.gte("created_at", startDateStr).lte("created_at", endDateStr);
      positiveQuery = positiveQuery.gte("created_at", startDateStr).lte("created_at", endDateStr);
      emailsQuery = emailsQuery.gte("sent_at", startDateStr).lte("sent_at", endDateStr);
    }

    // Execute all queries in parallel
    const [leadsResult, repliesResult, positiveResult, emailsResult] = await Promise.all([
      leadsQuery,
      repliesQuery,
      positiveQuery,
      emailsQuery,
    ]);

    const leadsContacted = leadsResult.count || 0;
    const replies = repliesResult.count || 0;
    const opportunities = positiveResult.count || 0;

    // Use email count from lead_emails if available, otherwise estimate from leads
    // (assumes each lead received at least 1 email)
    const emailsSent = emailsResult.count || leadsContacted;

    // Calculate reply rate
    const replyRate = leadsContacted > 0 ? (replies / leadsContacted) * 100 : 0;

    return NextResponse.json({
      period,
      start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
      end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
      leads_contacted: leadsContacted,
      emails_sent: emailsSent,
      replies,
      opportunities,
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
