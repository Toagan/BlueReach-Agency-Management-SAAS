import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface InvitationEmailProps {
  inviteeName: string;
  inviterName: string;
  clientName: string;
  agencyName: string;
  agencyLogoUrl?: string | null;
  agencyWebsiteUrl?: string;
  loginUrl: string;
  recipientEmail: string;
  primaryColor?: string;
}

export const InvitationEmail = ({
  inviteeName = "there",
  inviterName = "The BlueReach Team",
  clientName = "Your Company",
  agencyName = "BlueReach",
  agencyLogoUrl,
  agencyWebsiteUrl = "https://blue-reach.com",
  loginUrl = "https://app.blue-reach.com/login",
  recipientEmail = "user@example.com",
  primaryColor = "#4F46E5",
}: InvitationEmailProps) => {
  const firstName = inviteeName.split(" ")[0] || "there";

  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          `}
        </style>
      </Head>
      <Preview>
        You&apos;ve been invited to your {agencyName} Dashboard for {clientName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={headerSection}>
            {agencyLogoUrl ? (
              <Img
                src={agencyLogoUrl}
                alt={agencyName}
                height="48"
                style={logo}
              />
            ) : (
              <Text style={logoText}>{agencyName}</Text>
            )}
          </Section>

          {/* Main Content Card */}
          <Section style={contentCard}>
            {/* Heading */}
            <Heading style={heading}>
              You&apos;ve been invited to your {agencyName} Dashboard
            </Heading>

            {/* Body Copy */}
            <Text style={paragraph}>Hi {firstName},</Text>

            <Text style={paragraph}>
              <strong style={{ color: "#18181B" }}>{inviterName}</strong> has
              invited you to access the {agencyName} Sales Intelligence platform
              for <strong style={{ color: "#18181B" }}>{clientName}</strong>.
            </Text>

            <Text style={paragraph}>
              Your personalized dashboard gives you real-time visibility into
              your campaign performance, lead engagement metrics, and pipeline
              analytics.
            </Text>

            {/* CTA Button */}
            <Section style={buttonSection}>
              <Button style={{ ...button, backgroundColor: primaryColor }} href={loginUrl}>
                Access Your Dashboard
              </Button>
            </Section>

            {/* Link Fallback */}
            <Text style={linkFallback}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={linkText}>{loginUrl}</Text>

            <Hr style={divider} />

            {/* What to Expect */}
            <Text style={subheading}>What you&apos;ll get access to:</Text>
            <Text style={listItem}>
              <span style={bulletPoint}>&#x2022;</span> Real-time campaign
              analytics and performance metrics
            </Text>
            <Text style={listItem}>
              <span style={bulletPoint}>&#x2022;</span> Lead engagement tracking
              and positive reply notifications
            </Text>
            <Text style={listItem}>
              <span style={bulletPoint}>&#x2022;</span> Pipeline management and
              deal tracking tools
            </Text>
            <Text style={listItem}>
              <span style={bulletPoint}>&#x2022;</span> Full email thread
              history for all your leads
            </Text>

            <Hr style={divider} />

            {/* Security Note */}
            <Section style={securitySection}>
              <Text style={securityNote}>
                <span style={securityIcon}>&#x1F512;</span> This invitation was
                intended for{" "}
                <strong style={{ color: "#18181B" }}>{recipientEmail}</strong>.
                If you did not expect this invitation, you can safely ignore
                this email.
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Questions? Contact your {agencyName} account manager or reply to
              this email.
            </Text>
            <Text style={footerLinks}>
              {agencyWebsiteUrl && (
                <>
                  <Link href={agencyWebsiteUrl} style={footerLink}>
                    {agencyName} Website
                  </Link>
                  <span style={footerDivider}>|</span>
                </>
              )}
              <Link href="https://blue-reach.com" style={footerLink}>
                Powered by BlueReach
              </Link>
            </Text>
            <Text style={copyright}>
              &copy; {new Date().getFullYear()} {agencyName}. All rights
              reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Generate plain text version
export function generatePlainText(props: InvitationEmailProps): string {
  const firstName = props.inviteeName.split(" ")[0] || "there";

  return `
You've been invited to your ${props.agencyName} Dashboard

Hi ${firstName},

${props.inviterName} has invited you to access the ${props.agencyName} Sales Intelligence platform for ${props.clientName}.

Your personalized dashboard gives you real-time visibility into your campaign performance, lead engagement metrics, and pipeline analytics.

ACCESS YOUR DASHBOARD:
${props.loginUrl}

What you'll get access to:
- Real-time campaign analytics and performance metrics
- Lead engagement tracking and positive reply notifications
- Pipeline management and deal tracking tools
- Full email thread history for all your leads

---

SECURITY NOTE:
This invitation was intended for ${props.recipientEmail}. If you did not expect this invitation, you can safely ignore this email.

---

Questions? Contact your ${props.agencyName} account manager or reply to this email.

${props.agencyWebsiteUrl ? `${props.agencyName} Website: ${props.agencyWebsiteUrl}` : ""}
Powered by BlueReach - https://blue-reach.com

© ${new Date().getFullYear()} ${props.agencyName}. All rights reserved.
  `.trim();
}

export default InvitationEmail;

// BlueReach Design System
// Primary brand color: #4F46E5 (indigo-600)
// Font: Geist with system fallback
// Base radius: 10px (0.625rem)

const blueReachBrand = {
  primary: "#4F46E5",
  primaryForeground: "#FFFFFF",
  background: "#FAFAFA",
  card: "#FFFFFF",
  foreground: "#18181B",
  mutedForeground: "#71717A",
  border: "#E4E4E7",
  muted: "#F4F4F5",
};

// Styles
const main = {
  backgroundColor: blueReachBrand.background,
  fontFamily:
    "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  padding: "40px 0",
};

const container = {
  margin: "0 auto",
  maxWidth: "600px",
};

const headerSection = {
  padding: "24px 40px",
  textAlign: "center" as const,
};

const logo = {
  margin: "0 auto",
};

const logoText = {
  fontSize: "28px",
  fontWeight: "700",
  color: blueReachBrand.primary,
  margin: "0",
  textAlign: "center" as const,
  letterSpacing: "-0.02em",
};

const contentCard = {
  backgroundColor: blueReachBrand.card,
  borderRadius: "10px", // base radius
  padding: "48px 40px",
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  border: `1px solid ${blueReachBrand.border}`,
};

const heading = {
  fontSize: "24px",
  fontWeight: "600",
  color: blueReachBrand.foreground,
  lineHeight: "1.3",
  margin: "0 0 24px 0",
  textAlign: "center" as const,
  letterSpacing: "-0.02em",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.7",
  color: blueReachBrand.mutedForeground,
  margin: "0 0 16px 0",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: blueReachBrand.primary,
  borderRadius: "8px", // radius-md
  color: blueReachBrand.primaryForeground,
  fontSize: "15px",
  fontWeight: "500",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const linkFallback = {
  fontSize: "13px",
  color: blueReachBrand.mutedForeground,
  margin: "24px 0 8px 0",
  textAlign: "center" as const,
};

const linkText = {
  fontSize: "13px",
  color: blueReachBrand.primary,
  margin: "0 0 24px 0",
  textAlign: "center" as const,
  wordBreak: "break-all" as const,
};

const divider = {
  borderColor: blueReachBrand.border,
  borderWidth: "1px",
  margin: "32px 0",
};

const subheading = {
  fontSize: "15px",
  fontWeight: "600",
  color: blueReachBrand.foreground,
  margin: "0 0 12px 0",
};

const listItem = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: blueReachBrand.mutedForeground,
  margin: "0 0 8px 0",
  paddingLeft: "8px",
};

const bulletPoint = {
  color: blueReachBrand.primary,
  marginRight: "8px",
};

const securitySection = {
  backgroundColor: blueReachBrand.muted,
  borderRadius: "8px", // radius-md
  padding: "16px 20px",
  marginTop: "8px",
};

const securityNote = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: blueReachBrand.mutedForeground,
  margin: "0",
};

const securityIcon = {
  marginRight: "8px",
};

const footer = {
  padding: "32px 40px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "13px",
  color: blueReachBrand.mutedForeground,
  margin: "0 0 16px 0",
};

const footerLinks = {
  fontSize: "13px",
  margin: "0 0 16px 0",
};

const footerLink = {
  color: blueReachBrand.primary,
  textDecoration: "none",
};

const footerDivider = {
  color: blueReachBrand.border,
  margin: "0 12px",
};

const copyright = {
  fontSize: "12px",
  color: blueReachBrand.mutedForeground,
  margin: "0",
};
