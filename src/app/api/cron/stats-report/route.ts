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
  endDate: Date
): Promise<{ emailsSent: number; replies: number; positiveReplies: number; replyRate: number }> {
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  // Get all campaigns for this client
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("client_id", clientId);

  const campaignIds = campaigns?.map((c) => c.id) || [];

  if (campaignIds.length === 0) {
    return { emailsSent: 0, replies: 0, positiveReplies: 0, replyRate: 0 };
  }

  // Count leads created in the date range for this client
  const { count: leadsCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", startDateStr)
    .lte("created_at", endDateStr);

  // Count replies in the date range
  const { count: repliesCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("has_replied", true)
    .gte("updated_at", startDateStr)
    .lte("updated_at", endDateStr);

  // Count positive replies in the date range
  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("is_positive_reply", true)
    .gte("updated_at", startDateStr)
    .lte("updated_at", endDateStr);

  // Count outbound emails in the date range
  const { count: emailsCount } = await supabase
    .from("lead_emails")
    .select("*", { count: "exact", head: true })
    .in("campaign_id", campaignIds)
    .eq("direction", "outbound")
    .gte("sent_at", startDateStr)
    .lte("sent_at", endDateStr);

  const emailsSent = emailsCount || leadsCount || 0;
  const replies = repliesCount || 0;
  const positiveReplies = positiveCount || 0;
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
    // Optional: Verify cron secret for security
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow forcing a specific client for testing
    const forceClientId = searchParams.get("clientId");
    const forceInterval = searchParams.get("interval");

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

    if (forceClientId) {
      // Force send for a specific client
      clientsToReport.push({
        clientId: forceClientId,
        interval: forceInterval || "weekly",
      });
    } else if (settings) {
      // Extract client IDs and intervals from settings
      for (const setting of settings) {
        const match = setting.key.match(/^client_(.+)_stats_report_interval$/);
        if (match && setting.value && setting.value !== "disabled") {
          clientsToReport.push({
            clientId: match[1],
            interval: setting.value,
          });
        }
      }
    }

    if (clientsToReport.length === 0) {
      console.log("[Stats Report] No clients have stats reporting enabled");
      return NextResponse.json({
        success: true,
        message: "No clients have stats reporting enabled",
        reportsSent: 0,
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
        const { data: client } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", clientId)
          .single();

        if (!client) {
          console.log(`[Stats Report] Client ${clientId} not found`);
          continue;
        }

        // Get date ranges
        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(interval);

        // Get current period stats
        const stats = await getClientStats(supabase, clientId, startDate, endDate);

        // Get previous period stats for comparison
        const previousStats = await getClientStats(supabase, clientId, previousStartDate, previousEndDate);

        // Format period label
        const periodLabels: Record<string, string> = {
          daily: "Daily",
          weekly: "Weekly",
          monthly: "Monthly",
          "all-time": "All-Time",
        };
        const periodLabel = periodLabels[interval] || "Weekly";
        const periodRange = formatDateRange(startDate, endDate);

        console.log(`[Stats Report] Sending ${periodLabel} report for ${client.name}: ${stats.emailsSent} sent, ${stats.replies} replies, ${stats.positiveReplies} positive`);

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
    });
  } catch (error) {
    console.error("[Stats Report] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send stats reports" },
      { status: 500 }
    );
  }
}
