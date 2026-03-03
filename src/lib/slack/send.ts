import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
  accessory?: { type: string; text: { type: string; text: string; emoji?: boolean }; url: string };
}

async function postToSlack(webhookUrl: string, blocks: SlackBlock[], text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Slack] Webhook returned ${res.status}: ${body}`);
      return { success: false, error: `Slack returned ${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[Slack] Error posting to webhook:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to post to Slack" };
  }
}

export interface SendSlackPositiveReplyParams {
  leadEmail: string;
  leadName?: string;
  companyName?: string;
  campaignName: string;
  campaignId: string;
  clientId: string;
  clientName: string;
  replySnippet?: string;
}

export async function sendSlackPositiveReply(
  params: SendSlackPositiveReplyParams
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const supabase = getSupabase();

  // Read webhook URL
  const { data: webhookSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `client_${params.clientId}_slack_webhook_url`)
    .single();

  const webhookUrl = webhookSetting?.value;
  if (!webhookUrl) {
    return { success: true, skipped: true };
  }

  // Check campaign filter
  const { data: filterSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `client_${params.clientId}_slack_positive_reply_campaigns`)
    .single();

  const filterValue = filterSetting?.value;
  if (filterValue && filterValue !== "all") {
    try {
      const allowedCampaigns: string[] = JSON.parse(filterValue);
      if (!allowedCampaigns.includes(params.campaignId)) {
        console.log(`[Slack] Campaign ${params.campaignId} not in allowed list for client ${params.clientId}, skipping`);
        return { success: true, skipped: true };
      }
    } catch {
      // If parsing fails, treat as "all"
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
  const dashboardUrl = `${baseUrl}/admin/clients/${params.clientId}`;

  const replyText = params.replySnippet
    ? params.replySnippet.length > 200
      ? params.replySnippet.substring(0, 200) + "..."
      : params.replySnippet
    : null;

  const fallbackText = `New Positive Reply - ${params.clientName}: ${params.leadName || params.leadEmail}`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `New Positive Reply — ${params.clientName}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Lead:*\n${params.leadName || "—"} (${params.leadEmail})` },
        { type: "mrkdwn", text: `*Company:*\n${params.companyName || "—"}` },
        { type: "mrkdwn", text: `*Campaign:*\n${params.campaignName}` },
      ],
    },
  ];

  if (replyText) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Reply:*\n> ${replyText.replace(/\n/g, "\n> ")}` },
    });
  }

  blocks.push(
    { type: "divider" } as SlackBlock,
    {
      type: "section",
      text: { type: "mrkdwn", text: `<${dashboardUrl}|View in Dashboard>` },
    }
  );

  console.log(`[Slack] Sending positive reply notification for ${params.leadEmail} to client ${params.clientId}`);
  return postToSlack(webhookUrl, blocks, fallbackText);
}

export interface SendSlackStatsReportParams {
  clientId: string;
  clientName: string;
  periodLabel: string;
  periodRange: string;
  stats: {
    emailsSent: number;
    replies: number;
    positiveReplies: number;
    replyRate: number;
  };
  previousStats?: {
    emailsSent: number;
    replies: number;
    positiveReplies: number;
  };
}

function formatTrend(current: number, previous: number): string {
  if (previous === 0) return "";
  const pctChange = Math.round(((current - previous) / previous) * 100);
  if (pctChange > 0) return ` (+${pctChange}%)`;
  if (pctChange < 0) return ` (${pctChange}%)`;
  return "";
}

export async function sendSlackStatsReport(
  params: SendSlackStatsReportParams
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const supabase = getSupabase();

  // Read webhook URL
  const { data: webhookSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `client_${params.clientId}_slack_webhook_url`)
    .single();

  const webhookUrl = webhookSetting?.value;
  if (!webhookUrl) {
    return { success: true, skipped: true };
  }

  // Check if Slack stats are enabled
  const { data: intervalSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", `client_${params.clientId}_slack_stats_interval`)
    .single();

  const interval = intervalSetting?.value;
  if (!interval || interval === "disabled") {
    return { success: true, skipped: true };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
  const dashboardUrl = `${baseUrl}/admin/clients/${params.clientId}`;

  const sentTrend = params.previousStats ? formatTrend(params.stats.emailsSent, params.previousStats.emailsSent) : "";
  const repTrend = params.previousStats ? formatTrend(params.stats.replies, params.previousStats.replies) : "";
  const posTrend = params.previousStats ? formatTrend(params.stats.positiveReplies, params.previousStats.positiveReplies) : "";

  const fallbackText = `${params.periodLabel} Stats — ${params.clientName} (${params.periodRange})`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${params.periodLabel} Stats — ${params.clientName}`, emoji: true },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: params.periodRange }],
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Emails Sent:*\n${params.stats.emailsSent.toLocaleString()}${sentTrend}` },
        { type: "mrkdwn", text: `*Total Replies:*\n${params.stats.replies.toLocaleString()}${repTrend}` },
        { type: "mrkdwn", text: `*Positive Replies:*\n${params.stats.positiveReplies.toLocaleString()}${posTrend}` },
        { type: "mrkdwn", text: `*Reply Rate:*\n${params.stats.replyRate.toFixed(1)}%` },
      ],
    },
    { type: "divider" } as SlackBlock,
    {
      type: "section",
      text: { type: "mrkdwn", text: `<${dashboardUrl}|View Dashboard>` },
    },
  ];

  console.log(`[Slack] Sending ${params.periodLabel} stats report for client ${params.clientId}`);
  return postToSlack(webhookUrl, blocks, fallbackText);
}

export async function sendSlackTestMessage(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*BlueReach Slack Integration*\nThis is a test message. Your webhook is working correctly!" },
    },
  ];

  return postToSlack(webhookUrl, blocks, "BlueReach test message - webhook is working!");
}
