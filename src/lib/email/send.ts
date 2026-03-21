import { Resend } from "resend";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { InvitationEmail, generatePlainText } from "./templates/Invitation";
import {
  PositiveReplyNotification,
  generatePlainText as generatePositiveReplyPlainText,
} from "./templates/PositiveReplyNotification";
import {
  StatsReport,
  generateStatsReportPlainText,
} from "./templates/StatsReport";
import {
  SlackWebhookSetup,
  generateSlackSetupPlainText,
} from "./templates/SlackWebhookSetup";
import {
  HubSpotSetup,
  generateHubSpotSetupPlainText,
} from "./templates/HubSpotSetup";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface BrandingSettings {
  agencyName: string;
  agencyLogoUrl: string | null;
  agencyWebsiteUrl: string | null;
  primaryColor: string;
  senderName: string;
  senderEmail: string;
}

async function getBrandingSettings(ownerId?: string): Promise<BrandingSettings> {
  const supabase = getSupabase();

  let query = supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "agency_name",
      "agency_logo_url",
      "agency_website_url",
      "agency_primary_color",
      "agency_sender_name",
      "agency_sender_email",
    ]);

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data: settings } = await query;

  const settingsMap = new Map(settings?.map((s) => [s.key, s.value]) || []);

  const agencyName = settingsMap.get("agency_name") || "BlueReach";

  // Default sender name: "Tilman Schepke | BlueReach" format
  // Avoids redundancy like "BlueReach via BlueReach"
  let senderName = settingsMap.get("agency_sender_name");
  if (!senderName) {
    senderName = agencyName === "BlueReach"
      ? "Tilman Schepke | BlueReach"
      : `${agencyName} | BlueReach`;
  }

  return {
    agencyName,
    agencyLogoUrl: settingsMap.get("agency_logo_url") || null,
    agencyWebsiteUrl: settingsMap.get("agency_website_url") || "https://blue-reach.com",
    primaryColor: settingsMap.get("agency_primary_color") || "#0052FF",
    senderName,
    // Use verified blue-reach.com domain
    senderEmail: settingsMap.get("agency_sender_email") || "noreply@blue-reach.com",
  };
}

// Mask API key for logging (show first 6 and last 3 chars)
function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.substring(0, 6)}...${key.substring(key.length - 3)}`;
}

async function getResendClient(ownerId?: string): Promise<Resend | null> {
  // First, try to get API key from database settings
  const supabase = getSupabase();
  let resendQuery = supabase
    .from("settings")
    .select("value")
    .eq("key", "resend_api_key");

  if (ownerId) {
    resendQuery = resendQuery.eq("owner_id", ownerId);
  }

  const { data: setting } = await resendQuery.single();

  let apiKey = setting?.value;
  let source = "database";

  // Fallback to environment variable if database setting is empty
  if (!apiKey) {
    apiKey = process.env.RESEND_API_KEY;
    source = "environment";
  }

  if (!apiKey) {
    console.log("[Email] Resend API key not configured (checked database and RESEND_API_KEY env var)");
    return null;
  }

  console.log(`[Email] Using Resend API key from ${source}: ${maskApiKey(apiKey)}`);
  return new Resend(apiKey);
}

export interface SendInvitationEmailParams {
  to: string;
  inviteeName: string;
  inviterName?: string;
  clientName: string;
  loginUrl: string;
}

export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const resend = await getResendClient();

  if (!resend) {
    return { success: false, error: "Email service not configured" };
  }

  const branding = await getBrandingSettings();

  // Build template props
  const templateProps = {
    inviteeName: params.inviteeName,
    inviterName: params.inviterName || "Your account manager",
    clientName: params.clientName,
    agencyName: branding.agencyName,
    agencyLogoUrl: branding.agencyLogoUrl,
    agencyWebsiteUrl: branding.agencyWebsiteUrl || undefined,
    loginUrl: params.loginUrl,
    recipientEmail: params.to,
    primaryColor: branding.primaryColor,
  };

  // Render HTML and plain text versions
  const emailHtml = await render(InvitationEmail(templateProps));
  const emailText = generatePlainText(templateProps);

  try {
    console.log(`[Email] Sending invitation to ${params.to} for client "${params.clientName}"`);

    const { data, error } = await resend.emails.send({
      from: `${branding.senderName} <${branding.senderEmail}>`,
      to: params.to,
      subject: `You've been invited to your ${branding.agencyName} Dashboard`,
      html: emailHtml,
      text: emailText,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Successfully sent invitation (ID: ${data?.id})`);
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("[Email] Error sending invitation:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

export interface EmailThreadMessage {
  direction: "outbound" | "inbound";
  from_email: string;
  to_email?: string;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  sent_at: string;
}

export interface SendPositiveReplyNotificationParams {
  leadEmail: string;
  leadName?: string;
  leadPhone?: string;
  companyName?: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  replySnippet?: string;
  emailThread?: EmailThreadMessage[];
  leadDbId?: string;
  originalSubject?: string;
}

function stripHtmlToPlainText(html: string): string {
  return html
    // Remove style/head/script blocks entirely (including content)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove XML/VML conditional comments (Outlook)
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, "")
    // Remove XML namespace declarations
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/<o:p[\s\S]*?<\/o:p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up VML/CSS artifacts that may remain
    .replace(/[a-z]\\?:\*\s*\{[^}]*\}/gi, "")
    .replace(/\.shape\s*\{[^}]*\}/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ComposeUrlParams {
  leadEmail: string;
  leadName?: string;
  originalSubject?: string;
  emailThread?: EmailThreadMessage[];
}

function getReplySubject(params: ComposeUrlParams): string {
  let subject = params.originalSubject
    || params.emailThread?.find(e => e.direction === "outbound")?.subject
    || "Following up";
  subject = subject.replace(/^(Re:\s*)+/i, "").trim();
  return `Re: ${subject}`;
}

function cleanPlainText(text: string): string {
  return text
    // Remove VML/CSS artifact lines (e.g. "v\:* {behavior:url(#default#VML);}")
    .replace(/^[a-z\\]+:\*\s*\{[^}]*\}\s*$/gm, "")
    .replace(/^\.[a-z]+\s*\{[^}]*\}\s*$/gm, "")
    // Remove leftover XML namespace declarations
    .replace(/^<\/?[ovw]:[^>]*>\s*$/gm, "")
    // Collapse excessive blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getMessageBody(email: EmailThreadMessage): string {
  const raw = email.body_text
    || (email.body_html ? stripHtmlToPlainText(email.body_html) : "");
  return cleanPlainText(raw);
}

/**
 * Extract only the "new content" from an email body, stripping any
 * quoted reply text that the sender's email client appended.
 *
 * Looks for common quote markers:
 * - "On ... wrote:" (Gmail)
 * - "________________________________" (Outlook separator)
 * - Lines starting with ">" (plain text quoting)
 * - "From: " header blocks (Outlook)
 */
function extractOwnContent(email: EmailThreadMessage): string {
  // For HTML: strip everything from gmail_quote / blockquote onward
  if (email.body_html && !email.body_text) {
    let html = email.body_html;
    // Remove Gmail quoted blocks
    const gmailQuoteIdx = html.indexOf('<div class="gmail_quote"');
    if (gmailQuoteIdx > 0) html = html.substring(0, gmailQuoteIdx);
    // Remove generic blockquotes
    const blockquoteIdx = html.indexOf("<blockquote");
    if (blockquoteIdx > 0) html = html.substring(0, blockquoteIdx);
    return stripHtmlToPlainText(html);
  }

  const body = getMessageBody(email);
  const lines = body.split("\n");

  // Find the first line that looks like a quote attribution or separator
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Gmail: "On ... wrote:"
    if (/^On .+ wrote:$/.test(line)) {
      return lines.slice(0, i).join("\n").replace(/\n{2,}$/g, "").trim();
    }
    // Outlook separator
    if (/^_{5,}$/.test(line)) {
      return lines.slice(0, i).join("\n").replace(/\n{2,}$/g, "").trim();
    }
    // Outlook "From:" / "De:" header block (multi-language)
    if (/^(From|De|Von|Da|Van|Fra|Från|Od):\s+.+/i.test(line) && i + 1 < lines.length && /^(Sent|Enviada em|Gesendet|Inviato|Verzonden|Sendt|Skickat|Wysłano):\s+/i.test(lines[i + 1].trim())) {
      return lines.slice(0, i).join("\n").replace(/\n{2,}$/g, "").trim();
    }
    // Block of > quoted lines (at least 2 consecutive)
    if (line.startsWith(">") && i + 1 < lines.length && lines[i + 1].trim().startsWith(">")) {
      return lines.slice(0, i).join("\n").replace(/\n{2,}$/g, "").trim();
    }
  }
  return body.trim();
}

function truncateBody(body: string, max = 1500): string {
  if (body.length <= max) return body;
  return body.substring(0, max) + "\n\n[Thread truncated]";
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function getSenderName(email: EmailThreadMessage, leadName?: string): string {
  if (email.direction === "inbound" && leadName) return leadName;
  return email.from_email.split("@")[0];
}

/**
 * Build the reply body with proper `>` nesting per Gmail convention.
 * Used for token-based reply flow — body stored once, compose URLs built client-side.
 *
 * - Most recent message: `>` prefix
 * - Second most recent: `>>` prefix (nested inside)
 * - Each message's "own content" is extracted (quoted reply text stripped)
 */
function buildReplyBody(params: ComposeUrlParams): string {
  const thread = params.emailThread;

  let body = "\n\n";
  if (thread && thread.length > 0) {
    let quoted = "";
    for (let i = 0; i < thread.length; i++) {
      const email = thread[i];
      const d = new Date(email.sent_at);
      const name = getSenderName(email, params.leadName);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

      const attribution = `On ${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()} at ${time}, ${name} <${email.from_email}> wrote:`;
      const ownContent = extractOwnContent(email);

      const depth = thread.length - i;
      const prefix = "> ".repeat(depth);
      const attrPrefix = depth > 1 ? "> ".repeat(depth - 1) : "";

      const quotedLines = ownContent.split("\n").map(line => `${prefix}${line}`).join("\n");

      if (i === 0) {
        quoted = `${attrPrefix}${attribution}\n${quotedLines}`;
      } else {
        quoted = `${attrPrefix}${attribution}\n${quotedLines}\n${attrPrefix}>\n${quoted}`;
      }
    }

    body += quoted + "\n";
  }

  return truncateBody(body);
}

export async function sendPositiveReplyNotification(
  params: SendPositiveReplyNotificationParams
): Promise<{ success: boolean; error?: string; sentTo: string[] }> {
  const supabase = getSupabase();

  // Resolve the client's owner_id for tenant scoping
  const { data: client } = await supabase
    .from("clients")
    .select("owner_id")
    .eq("id", params.clientId)
    .single();
  const ownerId = client?.owner_id;

  const resend = await getResendClient(ownerId);

  if (!resend) {
    return { success: false, error: "Email service not configured", sentTo: [] };
  }

  const branding = await getBrandingSettings(ownerId);

  // Get client-specific notification preferences (scoped by owner)
  const settingKey = `client_${params.clientId}_notification_users`;
  let prefsQuery = supabase
    .from("settings")
    .select("value")
    .eq("key", settingKey);

  if (ownerId) {
    prefsQuery = prefsQuery.eq("owner_id", ownerId);
  }

  const { data: prefsSetting } = await prefsQuery.single();

  let enabledUserIds: string[] = [];
  if (prefsSetting?.value) {
    try {
      enabledUserIds = JSON.parse(prefsSetting.value);
    } catch {
      enabledUserIds = [];
    }
  }

  // If no client-specific preferences set, default to client's owner only
  if (!prefsSetting) {
    if (ownerId) {
      enabledUserIds = [ownerId];
    } else {
      // Fallback for orphaned clients: all admins
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      enabledUserIds = adminProfiles?.map((p) => p.id) || [];
    }
  }

  if (enabledUserIds.length === 0) {
    console.log("[Email] No users enabled for positive reply notifications");
    return { success: true, sentTo: [] };
  }

  // Get enabled users' email addresses
  const { data: enabledProfiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", enabledUserIds);

  const recipients: Array<{ email: string; name: string }> = [];

  if (enabledProfiles) {
    for (const profile of enabledProfiles) {
      if (profile.email) {
        recipients.push({
          email: profile.email,
          name: profile.full_name || profile.email.split("@")[0],
        });
      }
    }
  }

  if (recipients.length === 0) {
    console.log("[Email] No recipients for positive reply notification");
    return { success: true, sentTo: [] };
  }

  // Build dashboard URL with optional deep link to specific lead
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
  const dashboardUrl = params.leadDbId
    ? `${baseUrl}/admin/clients/${params.clientId}?lead=${params.leadDbId}`
    : `${baseUrl}/admin/clients/${params.clientId}`;

  // Build reply token — stores compose data server-side, URL is just /reply?token=UUID
  const composeParams: ComposeUrlParams = {
    leadEmail: params.leadEmail,
    leadName: params.leadName,
    originalSubject: params.originalSubject,
    emailThread: params.emailThread,
  };
  const subject = getReplySubject(composeParams);
  const body = buildReplyBody(composeParams);

  const { data: token } = await supabase
    .from("reply_tokens")
    .insert({
      lead_email: params.leadEmail,
      subject,
      body,
      lead_id: params.leadDbId || null,
    })
    .select("id")
    .single();

  const replyUrl = token
    ? `${baseUrl}/reply?token=${token.id}`
    : undefined;

  // Piggyback cleanup: delete expired tokens (>72h old)
  supabase
    .from("reply_tokens")
    .delete()
    .lt("created_at", new Date(Date.now() - 72 * 3600 * 1000).toISOString())
    .then(() => {});

  const sentTo: string[] = [];
  const errors: string[] = [];

  // Send to each recipient
  for (const recipient of recipients) {
    const templateProps = {
      recipientName: recipient.name,
      leadEmail: params.leadEmail,
      leadName: params.leadName,
      leadPhone: params.leadPhone,
      companyName: params.companyName,
      campaignName: params.campaignName,
      clientName: params.clientName,
      replySnippet: params.replySnippet,
      emailThread: params.emailThread,
      dashboardUrl,
      replyUrl,
    };

    try {
      const emailHtml = await render(PositiveReplyNotification(templateProps));
      const emailText = generatePositiveReplyPlainText(templateProps);

      const { data, error } = await resend.emails.send({
        from: `${branding.senderName} <${branding.senderEmail}>`,
        to: recipient.email,
        replyTo: params.leadEmail,
        subject: `🎯 New Positive Reply: ${params.leadName || params.leadEmail} - ${params.clientName}`,
        html: emailHtml,
        text: emailText,
      });

      if (error) {
        console.error(`[Email] Failed to send notification to ${recipient.email}:`, error);
        errors.push(`${recipient.email}: ${error.message}`);
      } else {
        console.log(`[Email] Sent positive reply notification to ${recipient.email} (ID: ${data?.id})`);
        sentTo.push(recipient.email);
      }
    } catch (err) {
      console.error(`[Email] Error sending notification to ${recipient.email}:`, err);
      errors.push(`${recipient.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return {
    success: sentTo.length > 0,
    error: errors.length > 0 ? errors.join("; ") : undefined,
    sentTo,
  };
}

export interface SendStatsReportParams {
  clientId: string;
  clientName: string;
  periodLabel: string; // "Weekly", "Daily", "Monthly"
  periodRange: string; // "Dec 30 - Jan 5"
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
  // Optional: Override recipients for testing
  customRecipients?: Array<{ email: string; name: string }>;
  ccRecipients?: string[];
}

export async function sendStatsReport(
  params: SendStatsReportParams
): Promise<{ success: boolean; error?: string; sentTo: string[] }> {
  const supabase = getSupabase();

  // Resolve the client's owner_id for tenant scoping
  const { data: clientData } = await supabase
    .from("clients")
    .select("owner_id")
    .eq("id", params.clientId)
    .single();
  const ownerId = clientData?.owner_id;

  const resend = await getResendClient(ownerId);

  if (!resend) {
    return { success: false, error: "Email service not configured", sentTo: [] };
  }

  const branding = await getBrandingSettings(ownerId);

  let recipients: Array<{ email: string; name: string }> = [];

  // Use custom recipients if provided (for testing)
  if (params.customRecipients && params.customRecipients.length > 0) {
    recipients = params.customRecipients;
    console.log(`[Email] Using ${recipients.length} custom recipients for stats report`);
  } else {
    // Get client-specific notification preferences (same users as positive reply notifications)
    const settingKey = `client_${params.clientId}_notification_users`;
    let prefsQuery = supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey);

    if (ownerId) {
      prefsQuery = prefsQuery.eq("owner_id", ownerId);
    }

    const { data: prefsSetting } = await prefsQuery.single();

    let enabledUserIds: string[] = [];
    if (prefsSetting?.value) {
      try {
        enabledUserIds = JSON.parse(prefsSetting.value);
      } catch {
        enabledUserIds = [];
      }
    }

    // If no client-specific preferences set, default to client's owner only
    if (!prefsSetting) {
      if (ownerId) {
        enabledUserIds = [ownerId];
      } else {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin");
        enabledUserIds = adminProfiles?.map((p) => p.id) || [];
      }
    }

    if (enabledUserIds.length === 0) {
      console.log("[Email] No users enabled for stats report notifications");
      return { success: true, sentTo: [] };
    }

    // Get enabled users' email addresses
    const { data: enabledProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", enabledUserIds);

    if (enabledProfiles) {
      for (const profile of enabledProfiles) {
        if (profile.email) {
          recipients.push({
            email: profile.email,
            name: profile.full_name || profile.email.split("@")[0],
          });
        }
      }
    }
  }

  if (recipients.length === 0) {
    console.log("[Email] No recipients for stats report");
    return { success: true, sentTo: [] };
  }

  // Build dashboard URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
  const dashboardUrl = `${baseUrl}/admin/clients/${params.clientId}`;

  const sentTo: string[] = [];
  const errors: string[] = [];

  // Send to each recipient
  for (const recipient of recipients) {
    const templateProps = {
      recipientName: recipient.name,
      clientName: params.clientName,
      periodLabel: params.periodLabel,
      periodRange: params.periodRange,
      stats: params.stats,
      previousStats: params.previousStats,
      dashboardUrl,
    };

    try {
      const emailHtml = await render(StatsReport(templateProps));
      const emailText = generateStatsReportPlainText(templateProps);

      const emailPayload: {
        from: string;
        to: string;
        cc?: string[];
        subject: string;
        html: string;
        text: string;
      } = {
        from: `${branding.senderName} <${branding.senderEmail}>`,
        to: recipient.email,
        subject: `📊 ${params.periodLabel} Stats Report: ${params.clientName} - ${params.stats.positiveReplies} positive replies`,
        html: emailHtml,
        text: emailText,
      };

      // Add CC recipients if provided
      if (params.ccRecipients && params.ccRecipients.length > 0) {
        emailPayload.cc = params.ccRecipients;
      }

      const { data, error } = await resend.emails.send(emailPayload);

      if (error) {
        console.error(`[Email] Failed to send stats report to ${recipient.email}:`, error);
        errors.push(`${recipient.email}: ${error.message}`);
      } else {
        console.log(`[Email] Sent stats report to ${recipient.email} (ID: ${data?.id})`);
        sentTo.push(recipient.email);
      }
    } catch (err) {
      console.error(`[Email] Error sending stats report to ${recipient.email}:`, err);
      errors.push(`${recipient.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return {
    success: sentTo.length > 0,
    error: errors.length > 0 ? errors.join("; ") : undefined,
    sentTo,
  };
}

export interface SendSlackSetupEmailParams {
  to: string;
  recipientName: string;
  clientName: string;
  clientId: string;
}

export async function sendSlackSetupEmail(
  params: SendSlackSetupEmailParams
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const resend = await getResendClient();

  if (!resend) {
    return { success: false, error: "Email service not configured" };
  }

  const branding = await getBrandingSettings();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
  const dashboardUrl = `${baseUrl}/admin/clients/${params.clientId}/settings`;

  const templateProps = {
    recipientName: params.recipientName,
    clientName: params.clientName,
    agencyName: branding.agencyName,
    dashboardUrl,
  };

  const emailHtml = await render(SlackWebhookSetup(templateProps));
  const emailText = generateSlackSetupPlainText(templateProps);

  try {
    console.log(`[Email] Sending Slack setup instructions to ${params.to} for client "${params.clientName}"`);

    const { data, error } = await resend.emails.send({
      from: `${branding.senderName} <${branding.senderEmail}>`,
      to: params.to,
      subject: `Set Up Slack Notifications for ${params.clientName}`,
      html: emailHtml,
      text: emailText,
    });

    if (error) {
      console.error("[Email] Failed to send Slack setup email:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Successfully sent Slack setup email (ID: ${data?.id})`);
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("[Email] Error sending Slack setup email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

export interface SendHubSpotSetupEmailParams {
  to: string;
  recipientName: string;
  clientName: string;
  clientId: string;
}

export async function sendHubSpotSetupEmail(
  params: SendHubSpotSetupEmailParams
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const resend = await getResendClient();

  if (!resend) {
    return { success: false, error: "Email service not configured" };
  }

  const branding = await getBrandingSettings();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
  const dashboardUrl = `${baseUrl}/admin/clients/${params.clientId}/settings`;

  const templateProps = {
    recipientName: params.recipientName,
    clientName: params.clientName,
    agencyName: branding.agencyName,
    dashboardUrl,
  };

  const emailHtml = await render(HubSpotSetup(templateProps));
  const emailText = generateHubSpotSetupPlainText(templateProps);

  try {
    console.log(`[Email] Sending HubSpot setup instructions to ${params.to} for client "${params.clientName}"`);

    const { data, error } = await resend.emails.send({
      from: `${branding.senderName} <${branding.senderEmail}>`,
      to: params.to,
      subject: `Connect HubSpot CRM for ${params.clientName}`,
      html: emailHtml,
      text: emailText,
    });

    if (error) {
      console.error("[Email] Failed to send HubSpot setup email:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Successfully sent HubSpot setup email (ID: ${data?.id})`);
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("[Email] Error sending HubSpot setup email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

// Alias for backward compatibility (lowercase 's' variant)
export interface SendHubspotSetupEmailParams {
  to: string;
  clientName: string;
  recipientName?: string;
}

export async function sendHubspotSetupEmail(
  params: SendHubspotSetupEmailParams
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  return sendHubSpotSetupEmail({
    to: params.to,
    clientName: params.clientName,
    recipientName: params.recipientName || params.to.split("@")[0],
    clientId: "", // No clientId available in this variant
  });
}

export { getBrandingSettings, buildReplyBody, getReplySubject };
