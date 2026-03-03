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

async function getBrandingSettings(): Promise<BrandingSettings> {
  const supabase = getSupabase();

  const { data: settings } = await supabase
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

async function getResendClient(): Promise<Resend | null> {
  // First, try to get API key from database settings
  const supabase = getSupabase();
  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "resend_api_key")
    .single();

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

function getMessageBody(email: EmailThreadMessage): string {
  return email.body_text
    || (email.body_html ? stripHtmlToPlainText(email.body_html) : "");
}

function truncateBody(body: string, max = 1500): string {
  if (body.length <= max) return body;
  return body.substring(0, max) + "\n\n[Thread truncated]";
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime12h(d: Date): { h12: number; minutes: string; ampm: string } {
  const hours = d.getHours();
  return {
    h12: hours % 12 || 12,
    minutes: d.getMinutes().toString().padStart(2, "0"),
    ampm: hours < 12 ? "AM" : "PM",
  };
}

function getSenderName(email: EmailThreadMessage, leadName?: string): string {
  if (email.direction === "inbound" && leadName) return leadName;
  return email.from_email.split("@")[0];
}

/**
 * Gmail compose URL — opens Gmail web/app on mobile.
 *
 * Only quotes the most recent email (its body already contains the full
 * nested conversation). Uses Gmail's native attribution format:
 *
 *   On Mon, 2 Mar 2026 at 23:16, Name <email> wrote:
 *   [body with nested quotes already inside]
 */
function buildGmailComposeUrl(params: ComposeUrlParams): string {
  const subject = getReplySubject(params);
  const thread = params.emailThread;

  let body = "\n\n";
  if (thread && thread.length > 0) {
    const lastEmail = thread[thread.length - 1];
    const d = new Date(lastEmail.sent_at);
    const name = getSenderName(lastEmail, params.leadName);
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const attribution = `On ${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()} at ${time}, ${name} <${lastEmail.from_email}> wrote:`;
    body += `${attribution}\n${getMessageBody(lastEmail)}\n`;
  }

  body = truncateBody(body);

  return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(params.leadEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Outlook compose URL — opens Outlook web/app on mobile.
 *
 * Only quotes the most recent email (its body already contains the full
 * nested conversation). Uses Outlook's native format:
 *
 *   ________________________________________
 *   From: Name <email>
 *   Sent: 03 March 2026 17:51
 *   To: recipient <email>
 *   Subject: Re: ...
 *
 *   [body with nested quotes already inside]
 */
function buildOutlookComposeUrl(params: ComposeUrlParams): string {
  const subject = getReplySubject(params);
  const thread = params.emailThread;

  let body = "\n\n";
  if (thread && thread.length > 0) {
    const lastEmail = thread[thread.length - 1];
    const d = new Date(lastEmail.sent_at);
    const name = getSenderName(lastEmail, params.leadName);
    const toEmail = lastEmail.to_email || params.leadEmail;
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    body += "________________________________________\n";
    body += `From: ${name} <${lastEmail.from_email}>\n`;
    body += `Sent: ${String(d.getDate()).padStart(2, "0")} ${MONTH_FULL[d.getMonth()]} ${d.getFullYear()} ${time}\n`;
    body += `To: ${toEmail}\n`;
    body += `Subject: ${lastEmail.subject || subject}\n\n`;
    body += getMessageBody(lastEmail);
    body += "\n";
  }

  body = truncateBody(body);

  return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(params.leadEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function sendPositiveReplyNotification(
  params: SendPositiveReplyNotificationParams
): Promise<{ success: boolean; error?: string; sentTo: string[] }> {
  const resend = await getResendClient();
  const supabase = getSupabase();

  if (!resend) {
    return { success: false, error: "Email service not configured", sentTo: [] };
  }

  const branding = await getBrandingSettings();

  // Get client-specific notification preferences
  const settingKey = `client_${params.clientId}_notification_users`;
  const { data: prefsSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", settingKey)
    .single();

  let enabledUserIds: string[] = [];
  if (prefsSetting?.value) {
    try {
      enabledUserIds = JSON.parse(prefsSetting.value);
    } catch {
      enabledUserIds = [];
    }
  }

  // If no client-specific preferences set, default to all admins
  if (!prefsSetting) {
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    enabledUserIds = adminProfiles?.map((p) => p.id) || [];
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

  // Build smart reply URL — redirects to Gmail or Outlook based on user preference
  const composeParams = {
    leadEmail: params.leadEmail,
    leadName: params.leadName,
    originalSubject: params.originalSubject,
    emailThread: params.emailThread,
  };
  const gmailUrl = buildGmailComposeUrl(composeParams);
  const outlookUrl = buildOutlookComposeUrl(composeParams);
  const replyUrl = `${baseUrl}/reply?to=${encodeURIComponent(params.leadEmail)}&gmail=${encodeURIComponent(gmailUrl)}&outlook=${encodeURIComponent(outlookUrl)}`;

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
  const resend = await getResendClient();
  const supabase = getSupabase();

  if (!resend) {
    return { success: false, error: "Email service not configured", sentTo: [] };
  }

  const branding = await getBrandingSettings();

  let recipients: Array<{ email: string; name: string }> = [];

  // Use custom recipients if provided (for testing)
  if (params.customRecipients && params.customRecipients.length > 0) {
    recipients = params.customRecipients;
    console.log(`[Email] Using ${recipients.length} custom recipients for stats report`);
  } else {
    // Get client-specific notification preferences (same users as positive reply notifications)
    const settingKey = `client_${params.clientId}_notification_users`;
    const { data: prefsSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey)
      .single();

    let enabledUserIds: string[] = [];
    if (prefsSetting?.value) {
      try {
        enabledUserIds = JSON.parse(prefsSetting.value);
      } catch {
        enabledUserIds = [];
      }
    }

    // If no client-specific preferences set, default to all admins
    if (!prefsSetting) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      enabledUserIds = adminProfiles?.map((p) => p.id) || [];
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

/** Build the smart reply redirect URL that auto-detects Gmail vs Outlook */
function buildReplyUrl(baseUrl: string, params: ComposeUrlParams): string {
  const gmailUrl = buildGmailComposeUrl(params);
  const outlookUrl = buildOutlookComposeUrl(params);
  return `${baseUrl}/reply?to=${encodeURIComponent(params.leadEmail)}&gmail=${encodeURIComponent(gmailUrl)}&outlook=${encodeURIComponent(outlookUrl)}`;
}

export { getBrandingSettings, buildGmailComposeUrl, buildOutlookComposeUrl, buildReplyUrl };
