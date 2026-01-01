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

// GET - Get analytics from database
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all_time";

    const supabase = getSupabase();
    const dateRange = getDateRange(period);

    // Build query for total leads (contacted)
    let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true });

    // Build query for replies - simple boolean check
    let repliesQuery = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("has_replied", true);

    // Build query for positive replies
    let positiveQuery = supabase.from("leads").select("*", { count: "exact", head: true }).eq("is_positive_reply", true);

    // Apply date filter if not all_time
    if (dateRange) {
      const startDateStr = dateRange.startDate.toISOString();
      const endDateStr = dateRange.endDate.toISOString();

      leadsQuery = leadsQuery.gte("created_at", startDateStr).lte("created_at", endDateStr);
      repliesQuery = repliesQuery.gte("created_at", startDateStr).lte("created_at", endDateStr);
      positiveQuery = positiveQuery.gte("created_at", startDateStr).lte("created_at", endDateStr);
    }

    // Execute all queries in parallel
    const [leadsResult, repliesResult, positiveResult] = await Promise.all([
      leadsQuery,
      repliesQuery,
      positiveQuery,
    ]);

    const leadsContacted = leadsResult.count || 0;
    const replies = repliesResult.count || 0;
    const opportunities = positiveResult.count || 0;

    // For emails sent, we'll use leads contacted as a proxy
    // (each lead represents at least one email sent)
    // Could also sum email counts if you want total emails including follow-ups
    const emailsSent = leadsContacted;

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
