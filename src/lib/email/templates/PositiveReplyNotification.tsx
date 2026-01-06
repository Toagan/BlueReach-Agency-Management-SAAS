import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface PositiveReplyNotificationProps {
  recipientName: string;
  leadEmail: string;
  leadName?: string;
  companyName?: string;
  campaignName: string;
  clientName: string;
  replySnippet?: string;
  dashboardUrl: string;
}

export const PositiveReplyNotification = ({
  recipientName = "there",
  leadEmail = "lead@example.com",
  leadName,
  companyName,
  campaignName = "Campaign",
  clientName = "Client",
  replySnippet,
  dashboardUrl = "https://app.blue-reach.com",
}: PositiveReplyNotificationProps) => {
  const firstName = recipientName.split(" ")[0] || "there";

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>
        New positive reply from {leadName || leadEmail} - {clientName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerBrand}>
              <span style={headerWave}>🌊</span> BlueReach
            </Text>
          </Section>

          {/* Main Content */}
          <Section style={main}>
            {/* Alert Badge */}
            <div style={alertBadge}>
              <span style={alertIcon}>🎯</span>
              <span style={alertText}>New Positive Reply</span>
            </div>

            <Heading style={heading}>
              Hey {firstName}, you got a hot lead!
            </Heading>

            <Text style={subtext}>
              A lead from <strong>{clientName}</strong> just expressed interest.
            </Text>

            {/* Lead Card */}
            <div style={leadCard}>
              <table cellPadding="0" cellSpacing="0" style={leadTable}>
                <tr>
                  <td style={leadLabelCell}>Lead</td>
                  <td style={leadValueCell}>
                    <strong>{leadName || "—"}</strong>
                    <br />
                    <span style={leadEmailStyle}>{leadEmail}</span>
                  </td>
                </tr>
                {companyName && (
                  <tr>
                    <td style={leadLabelCell}>Company</td>
                    <td style={leadValueCell}>{companyName}</td>
                  </tr>
                )}
                <tr>
                  <td style={leadLabelCell}>Campaign</td>
                  <td style={leadValueCell}>{campaignName}</td>
                </tr>
                <tr>
                  <td style={leadLabelCell}>Client</td>
                  <td style={leadValueCell}>{clientName}</td>
                </tr>
              </table>
            </div>

            {/* Reply Snippet */}
            {replySnippet && (
              <div style={replyBox}>
                <Text style={replyLabel}>Reply Preview</Text>
                <Text style={replyContent}>"{replySnippet}"</Text>
              </div>
            )}

            {/* CTA */}
            <Section style={ctaSection}>
              <Button style={ctaButton} href={dashboardUrl}>
                View in Dashboard
              </Button>
            </Section>

            <Text style={tipText}>
              Tip: Follow up within 5 minutes for the best conversion rate!
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerBrand}>
              <span style={footerWave}>🌊</span> BlueReach
            </Text>
            <Text style={footerLinks}>
              <Link href="https://blue-reach.com" style={footerLink}>Website</Link>
              <span style={footerDot}> · </span>
              <Link href="mailto:support@blue-reach.com" style={footerLink}>Support</Link>
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} BlueReach · B2B Lead Generation
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export function generatePlainText(props: PositiveReplyNotificationProps): string {
  const firstName = props.recipientName.split(" ")[0] || "there";
  return `
🌊 BLUEREACH - NEW POSITIVE REPLY

Hey ${firstName}, you got a hot lead!

A lead from ${props.clientName} just expressed interest.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEAD DETAILS:
• Name: ${props.leadName || "—"}
• Email: ${props.leadEmail}
${props.companyName ? `• Company: ${props.companyName}` : ""}
• Campaign: ${props.campaignName}
• Client: ${props.clientName}

${props.replySnippet ? `REPLY PREVIEW:\n"${props.replySnippet}"` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View in Dashboard: ${props.dashboardUrl}

Tip: Follow up within 5 minutes for the best conversion rate!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌊 BlueReach
B2B Lead Generation
© ${new Date().getFullYear()}
  `.trim();
}

export default PositiveReplyNotification;

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  navy: "#0A1628",
  green: "#10B981",
  greenLight: "#D1FAE5",
  greenDark: "#065F46",
  blue: "#3B82F6",
  white: "#FFFFFF",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray800: "#1E293B",
};

const body = {
  backgroundColor: colors.gray100,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: "0",
  padding: "0",
};

const container = {
  margin: "0 auto",
  maxWidth: "540px",
  padding: "20px",
};

const header = {
  textAlign: "center" as const,
  padding: "20px 0",
};

const headerBrand = {
  fontSize: "18px",
  fontWeight: "700",
  color: colors.navy,
  margin: "0",
};

const headerWave = {
  marginRight: "6px",
};

const main = {
  backgroundColor: colors.white,
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const alertBadge = {
  display: "inline-block",
  backgroundColor: colors.greenLight,
  borderRadius: "20px",
  padding: "8px 16px",
  marginBottom: "20px",
};

const alertIcon = {
  marginRight: "8px",
};

const alertText = {
  fontSize: "13px",
  fontWeight: "600",
  color: colors.greenDark,
};

const heading = {
  fontSize: "24px",
  fontWeight: "700",
  color: colors.gray800,
  lineHeight: "1.3",
  margin: "0 0 12px 0",
};

const subtext = {
  fontSize: "15px",
  color: colors.gray600,
  margin: "0 0 24px 0",
  lineHeight: "1.5",
};

const leadCard = {
  backgroundColor: colors.gray100,
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "20px",
};

const leadTable = {
  width: "100%",
};

const leadLabelCell = {
  fontSize: "12px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  padding: "8px 0",
  width: "100px",
  verticalAlign: "top" as const,
};

const leadValueCell = {
  fontSize: "14px",
  color: colors.gray800,
  padding: "8px 0",
};

const leadEmailStyle = {
  fontSize: "13px",
  color: colors.gray500,
};

const replyBox = {
  backgroundColor: colors.gray100,
  borderLeft: `3px solid ${colors.green}`,
  borderRadius: "0 8px 8px 0",
  padding: "16px",
  marginBottom: "24px",
};

const replyLabel = {
  fontSize: "11px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 8px 0",
};

const replyContent = {
  fontSize: "14px",
  color: colors.gray600,
  fontStyle: "italic" as const,
  margin: "0",
  lineHeight: "1.5",
};

const ctaSection = {
  textAlign: "center" as const,
  marginBottom: "20px",
};

const ctaButton = {
  backgroundColor: colors.green,
  borderRadius: "10px",
  color: colors.white,
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const tipText = {
  fontSize: "13px",
  color: colors.gray500,
  textAlign: "center" as const,
  margin: "0",
};

const footer = {
  padding: "24px",
  textAlign: "center" as const,
};

const footerBrand = {
  fontSize: "14px",
  fontWeight: "600",
  color: colors.gray600,
  margin: "0 0 8px 0",
};

const footerWave = {
  marginRight: "4px",
};

const footerLinks = {
  fontSize: "13px",
  margin: "0 0 8px 0",
};

const footerLink = {
  color: colors.gray500,
  textDecoration: "none",
};

const footerDot = {
  color: colors.gray400,
};

const copyright = {
  fontSize: "11px",
  color: colors.gray400,
  margin: "0",
};
