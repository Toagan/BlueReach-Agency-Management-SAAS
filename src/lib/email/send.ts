import { Resend } from "resend";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { InvitationEmail, generatePlainText } from "./templates/Invitation";

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
    primaryColor: settingsMap.get("agency_primary_color") || "#4F46E5",
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

export { getBrandingSettings };
