import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendStatsReport } from "@/lib/email";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to format date range
function formatDateRange(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = startDate.toLocaleDateString("en-US", options);
  const end = endDate.toLocaleDateString("en-US", options);
  return `${start} - ${end}`;
}

// Get date range based on interval
function getDateRange(interval: string): { startDate: Date; endDate: Date; previousStartDate: Date; previousEndDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;
  let previousStartDate: Date;
  let previousEndDate: Date;

  switch (interval) {
    case "daily": {
      // Yesterday
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);

      // Day before yesterday
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 1);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
      break;
    }
    case "weekly": {
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      // Previous 7 days
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 7);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
      break;
    }
    case "monthly": {
      // Last 30 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);

      // Previous 30 days
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 30);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
      break;
    }
    case "all-time": {
      // All time - from Jan 1, 2020 to now
      startDate = new Date("2020-01-01T00:00:00.000Z");

      // No previous period for all-time
      previousStartDate = new Date(startDate);
      previousEndDate = new Date(startDate);
      break;
    }
    default: {
      // Default to weekly
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 7);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
    }
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
}

// Get stats for a client within a date range
async function getClientStats(
  supabase: ReturnType<typeof getSupabase>,
  clientId: string,
  startDate: Date,
  endDate: Date,
  isAllTime: boolean = false
): Promise<{ emailsSent: number; replies: number; positiveReplies: number; replyRate: number }> {
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  let emailsSent = 0;
  let replies = 0;
  let positiveReplies = 0;

  if (isAllTime) {
    // For all-time stats, count ALL leads for this client (no date filter)
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    // Count ALL replies for this client
    const { count: totalReplies } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("has_replied", true);

    // Count ALL positive replies for this client
    const { count: totalPositive } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_positive_reply", true);

    emailsSent = totalLeads || 0;
    replies = totalReplies || 0;
    positiveReplies = totalPositive || 0;
  } else {
    // For date-range stats, use date filters
    // Count leads created in the date range
    const { count: leadsCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("created_at", startDateStr)
      .lte("created_at", endDateStr);

    // Count replies in the date range (based on when they replied)
    const { count: repliesCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("has_replied", true)
      .gte("responded_at", startDateStr)
      .lte("responded_at", endDateStr);

    // Count positive replies in the date range
    const { count: positiveCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_positive_reply", true)
      .gte("responded_at", startDateStr)
      .lte("responded_at", endDateStr);

    emailsSent = leadsCount || 0;
    replies = repliesCount || 0;
    positiveReplies = positiveCount || 0;
  }

  const replyRate = emailsSent > 0 ? (replies / emailsSent) * 100 : 0;

  return { emailsSent, replies, positiveReplies, replyRate };
}

// POST - Send stats reports (called by cron job)
// Also accepts GET for easy testing
export async function POST(request: NextRequest) {
  return handleStatsReport(request);
}

export async function GET(request: NextRequest) {
  return handleStatsReport(request);
}

async function handleStatsReport(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Allow forcing a specific client for testing
    const forceClientId = searchParams.get("clientId");
    const forceInterval = searchParams.get("interval");

    // Verify cron secret for security (only required for scheduled cron jobs, not test requests)
    // Test requests with clientId are allowed without secret (for UI "Send Now" button)
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret && !forceClientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Custom recipients for testing (comma-separated)
    const customToParam = searchParams.get("to");
    const customCcParam = searchParams.get("cc");

    // Parse custom recipients
    const customRecipients = customToParam
      ? customToParam.split(",").map((email) => ({
          email: email.trim(),
          name: email.trim().split("@")[0],
        }))
      : undefined;

    const ccRecipients = customCcParam
      ? customCcParam.split(",").map((email) => email.trim())
      : undefined;

    const supabase = getSupabase();

    // Get all clients with stats reporting enabled
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .like("key", "client_%_stats_report_interval");

    const clientsToReport: Array<{ clientId: string; interval: string }> = [];

    // Helper to check if we should send based on interval
    const shouldSendToday = (interval: string): boolean => {
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      const dayOfMonth = now.getUTCDate();

      switch (interval) {
        case "daily":
          return true; // Send every day
        case "weekly":
          return dayOfWeek === 1; // Send on Mondays
        case "monthly":
          return dayOfMonth === 1; // Send on 1st of month
        default:
          return false;
      }
    };

    if (forceClientId) {
      // Force send for a specific client (bypass day check)
      clientsToReport.push({
        clientId: forceClientId,
        interval: forceInterval || "weekly",
      });
    } else if (settings) {
      // Extract client IDs and intervals from settings
      for (const setting of settings) {
        const match = setting.key.match(/^client_(.+)_stats_report_interval$/);
        if (match && setting.value && setting.value !== "disabled") {
          // Only add if today is the right day for this interval
          if (shouldSendToday(setting.value)) {
            clientsToReport.push({
              clientId: match[1],
              interval: setting.value,
            });
          }
        }
      }
    }

    if (clientsToReport.length === 0) {
      const now = new Date();
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getUTCDay()];
      console.log(`[Stats Report] No reports to send today (${dayName}, day ${now.getUTCDate()} of month)`);
      return NextResponse.json({
        success: true,
        message: `No reports scheduled for today (${dayName})`,
        reportsSent: 0,
        note: "Daily reports send every day, weekly on Mondays, monthly on the 1st",
      });
    }

    console.log(`[Stats Report] Processing ${clientsToReport.length} clients`);

    const results: Array<{
      clientId: string;
      clientName: string;
      success: boolean;
      sentTo: string[];
      error?: string;
    }> = [];

    for (const { clientId, interval } of clientsToReport) {
      try {
        // Get client info
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", clientId)
          .single();

        if (clientError || !client) {
          console.log(`[Stats Report] Client ${clientId} not found:`, clientError?.message);
          results.push({
            clientId,
            clientName: "NOT_FOUND",
            success: false,
            sentTo: [],
            error: clientError?.message || "Client not found in database",
          });
          continue;
        }

        // Get date ranges
        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(interval);
        const isAllTime = interval === "all-time";

        // Get current period stats
        const stats = await getClientStats(supabase, clientId, startDate, endDate, isAllTime);

        // Get previous period stats for comparison (skip for all-time)
        const previousStats = isAllTime
          ? { emailsSent: 0, replies: 0, positiveReplies: 0, replyRate: 0 }
          : await getClientStats(supabase, clientId, previousStartDate, previousEndDate, false);

        // Format period label
        const periodLabels: Record<string, string> = {
          daily: "Daily",
          weekly: "Weekly",
          monthly: "Monthly",
          "all-time": "All-Time",
        };
        const periodLabel = periodLabels[interval] || "Weekly";
        const periodRange = formatDateRange(startDate, endDate);

        console.log(`[Stats Report v2] Sending ${periodLabel} report for ${client.name}: ${stats.emailsSent} leads contacted, ${stats.replies} replies, ${stats.positiveReplies} positive (isAllTime=${isAllTime})`);

        // Send the report
        const result = await sendStatsReport({
          clientId,
          clientName: client.name,
          periodLabel,
          periodRange,
          stats,
          previousStats: interval !== "all-time" ? {
            emailsSent: previousStats.emailsSent,
            replies: previousStats.replies,
            positiveReplies: previousStats.positiveReplies,
          } : undefined,
          customRecipients,
          ccRecipients,
        });

        results.push({
          clientId,
          clientName: client.name,
          success: result.success,
          sentTo: result.sentTo,
          error: result.error,
        });

        // Update last report sent timestamp
        await supabase
          .from("settings")
          .upsert({
            key: `client_${clientId}_stats_report_last_sent`,
            value: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "key",
          });

      } catch (clientError) {
        console.error(`[Stats Report] Error processing client ${clientId}:`, clientError);
        results.push({
          clientId,
          clientName: "Unknown",
          success: false,
          sentTo: [],
          error: clientError instanceof Error ? clientError.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const totalRecipients = results.reduce((sum, r) => sum + r.sentTo.length, 0);

    console.log(`[Stats Report] Completed: ${successCount}/${results.length} clients, ${totalRecipients} emails sent`);

    return NextResponse.json({
      success: true,
      message: `Stats reports sent for ${successCount} clients`,
      reportsSent: successCount,
      totalRecipients,
      results,
      version: "v6-allow-test-requests",
      clientsToProcess: clientsToReport,
    });
  } catch (error) {
    console.error("[Stats Report] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send stats reports" },
      { status: 500 }
    );
  }
}
