import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface BrandingSettings {
  agencyName: string;
  agencyLogoUrl: string | null;
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
      "agency_primary_color",
      "agency_sender_name",
      "agency_sender_email",
    ]);

  const settingsMap = new Map(settings?.map((s) => [s.key, s.value]) || []);

  return {
    agencyName: settingsMap.get("agency_name") || "BlueReach",
    agencyLogoUrl: settingsMap.get("agency_logo_url") || null,
    primaryColor: settingsMap.get("agency_primary_color") || "#2563eb",
    senderName: settingsMap.get("agency_sender_name") || "BlueReach Team",
    senderEmail: settingsMap.get("agency_sender_email") || "noreply@bluereach.com",
  };
}

async function getResendClient(): Promise<Resend | null> {
  const supabase = getSupabase();

  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "resend_api_key")
    .single();

  if (!setting?.value) {
    console.log("[Email] Resend API key not configured");
    return null;
  }

  return new Resend(setting.value);
}

interface SendInvitationEmailParams {
  to: string;
  inviteeName: string;
  clientName: string;
  loginUrl: string;
}

export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = await getResendClient();

  if (!resend) {
    return { success: false, error: "Email service not configured" };
  }

  const branding = await getBrandingSettings();

  const emailHtml = generateInvitationEmailHtml({
    ...params,
    branding,
  });

  try {
    const { error } = await resend.emails.send({
      from: `${branding.senderName} <${branding.senderEmail}>`,
      to: params.to,
      subject: `You've been invited to ${params.clientName} Dashboard`,
      html: emailHtml,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[Email] Error sending invitation:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

interface GenerateEmailHtmlParams extends SendInvitationEmailParams {
  branding: BrandingSettings;
}

function generateInvitationEmailHtml(params: GenerateEmailHtmlParams): string {
  const { inviteeName, clientName, loginUrl, branding } = params;
  const firstName = inviteeName.split(" ")[0] || "there";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              ${branding.agencyLogoUrl
                ? `<img src="${branding.agencyLogoUrl}" alt="${branding.agencyName}" style="height: 50px; max-width: 200px;">`
                : `<h1 style="margin: 0; color: ${branding.primaryColor}; font-size: 28px; font-weight: 700;">${branding.agencyName}</h1>`
              }
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <h2 style="margin: 0 0 20px 0; color: #18181b; font-size: 24px; font-weight: 600;">
                Hi ${firstName}!
              </h2>

              <p style="margin: 0 0 20px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                You've been invited to access the <strong style="color: #18181b;">${clientName}</strong> dashboard. This is where you can track your campaign performance and see real-time analytics.
              </p>

              <p style="margin: 0 0 30px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                Click the button below to create your account and get started:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 32px; background-color: ${branding.primaryColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Access Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: ${branding.primaryColor}; font-size: 14px; word-break: break-all;">
                ${loginUrl}
              </p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;">

              <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 20px;">
              <p style="margin: 0; color: #a1a1aa; font-size: 14px;">
                Sent by ${branding.agencyName}
              </p>
              <p style="margin: 10px 0 0 0; color: #d4d4d8; font-size: 12px;">
                Powered by BlueReach Agency Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export { getBrandingSettings };
