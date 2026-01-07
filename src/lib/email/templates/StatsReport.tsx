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

export interface StatsReportProps {
  recipientName: string;
  clientName: string;
  periodLabel: string; // e.g., "Weekly", "Daily", "Monthly"
  periodRange: string; // e.g., "Dec 30 - Jan 5"
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
  dashboardUrl: string;
}

export const StatsReport = ({
  recipientName = "there",
  clientName = "Client",
  periodLabel = "Weekly",
  periodRange = "This period",
  stats = { emailsSent: 0, replies: 0, positiveReplies: 0, replyRate: 0 },
  previousStats,
  dashboardUrl = "https://app.blue-reach.com",
}: StatsReportProps) => {
  const firstName = recipientName.split(" ")[0] || "there";

  // Calculate changes from previous period
  const getChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const emailsChange = previousStats ? getChange(stats.emailsSent, previousStats.emailsSent) : null;
  const repliesChange = previousStats ? getChange(stats.replies, previousStats.replies) : null;
  const positiveChange = previousStats ? getChange(stats.positiveReplies, previousStats.positiveReplies) : null;

  const formatChange = (change: number | null) => {
    if (change === null) return null;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(0)}%`;
  };

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>
        {periodLabel} Stats Report for {clientName} - {stats.positiveReplies} positive replies
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
            {/* Report Badge */}
            <div style={reportBadge}>
              <span style={reportIcon}>📊</span>
              <span style={reportText}>{periodLabel} Stats Report</span>
            </div>

            <Heading style={heading}>
              Hey {firstName}, here&apos;s your {periodLabel.toLowerCase()} update
            </Heading>

            <Text style={subtext}>
              Campaign performance for <strong>{clientName}</strong> during {periodRange}.
            </Text>

            {/* Stats Grid */}
            <div style={statsGrid}>
              {/* Emails Sent */}
              <div style={statCard}>
                <div style={statIcon}>📧</div>
                <div style={statValue}>{stats.emailsSent.toLocaleString()}</div>
                <div style={statLabel}>Emails Sent</div>
                {emailsChange !== null && (
                  <div style={emailsChange >= 0 ? statChangePositive : statChangeNegative}>
                    {formatChange(emailsChange)} vs last period
                  </div>
                )}
              </div>

              {/* Replies */}
              <div style={statCard}>
                <div style={statIcon}>💬</div>
                <div style={statValue}>{stats.replies.toLocaleString()}</div>
                <div style={statLabel}>Replies</div>
                {repliesChange !== null && (
                  <div style={repliesChange >= 0 ? statChangePositive : statChangeNegative}>
                    {formatChange(repliesChange)} vs last period
                  </div>
                )}
              </div>

              {/* Positive Replies */}
              <div style={statCardHighlight}>
                <div style={statIcon}>🎯</div>
                <div style={statValueHighlight}>{stats.positiveReplies.toLocaleString()}</div>
                <div style={statLabelHighlight}>Positive Replies</div>
                {positiveChange !== null && (
                  <div style={positiveChange >= 0 ? statChangePositiveAlt : statChangeNegativeAlt}>
                    {formatChange(positiveChange)} vs last period
                  </div>
                )}
              </div>
            </div>

            {/* Reply Rate */}
            <div style={replyRateBox}>
              <Text style={replyRateLabel}>Reply Rate</Text>
              <Text style={replyRateValue}>{stats.replyRate.toFixed(1)}%</Text>
            </div>

            {/* CTA */}
            <Section style={ctaSection}>
              <Button style={ctaButton} href={dashboardUrl}>
                View Full Dashboard
              </Button>
            </Section>

            <Text style={tipText}>
              Keep the momentum going! Consistent outreach leads to consistent results.
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

export function generateStatsReportPlainText(props: StatsReportProps): string {
  const firstName = props.recipientName.split(" ")[0] || "there";
  return `
🌊 BLUEREACH - ${props.periodLabel.toUpperCase()} STATS REPORT

Hey ${firstName}, here's your ${props.periodLabel.toLowerCase()} update!

Campaign performance for ${props.clientName} during ${props.periodRange}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 EMAILS SENT: ${props.stats.emailsSent.toLocaleString()}
💬 REPLIES: ${props.stats.replies.toLocaleString()}
🎯 POSITIVE REPLIES: ${props.stats.positiveReplies.toLocaleString()}

📈 REPLY RATE: ${props.stats.replyRate.toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View Full Dashboard: ${props.dashboardUrl}

Keep the momentum going! Consistent outreach leads to consistent results.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌊 BlueReach
B2B Lead Generation
© ${new Date().getFullYear()}
  `.trim();
}

export default StatsReport;

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  navy: "#0A1628",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
  blueDark: "#1E40AF",
  green: "#10B981",
  greenLight: "#D1FAE5",
  red: "#EF4444",
  redLight: "#FEE2E2",
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

const reportBadge = {
  display: "inline-block",
  backgroundColor: colors.blueLight,
  borderRadius: "20px",
  padding: "8px 16px",
  marginBottom: "20px",
};

const reportIcon = {
  marginRight: "8px",
};

const reportText = {
  fontSize: "13px",
  fontWeight: "600",
  color: colors.blueDark,
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

const statsGrid = {
  display: "flex",
  gap: "12px",
  marginBottom: "20px",
};

const statCard = {
  flex: "1",
  backgroundColor: colors.gray100,
  borderRadius: "12px",
  padding: "16px",
  textAlign: "center" as const,
};

const statCardHighlight = {
  flex: "1",
  backgroundColor: colors.greenLight,
  borderRadius: "12px",
  padding: "16px",
  textAlign: "center" as const,
};

const statIcon = {
  fontSize: "24px",
  marginBottom: "8px",
};

const statValue = {
  fontSize: "28px",
  fontWeight: "700",
  color: colors.gray800,
  lineHeight: "1",
  marginBottom: "4px",
};

const statValueHighlight = {
  fontSize: "28px",
  fontWeight: "700",
  color: colors.green,
  lineHeight: "1",
  marginBottom: "4px",
};

const statLabel = {
  fontSize: "12px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const statLabelHighlight = {
  fontSize: "12px",
  fontWeight: "600",
  color: colors.green,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const statChangePositive = {
  fontSize: "11px",
  color: colors.green,
  marginTop: "4px",
};

const statChangeNegative = {
  fontSize: "11px",
  color: colors.red,
  marginTop: "4px",
};

const statChangePositiveAlt = {
  fontSize: "11px",
  color: colors.green,
  marginTop: "4px",
  fontWeight: "600",
};

const statChangeNegativeAlt = {
  fontSize: "11px",
  color: colors.red,
  marginTop: "4px",
  fontWeight: "600",
};

const replyRateBox = {
  backgroundColor: colors.gray100,
  borderRadius: "12px",
  padding: "16px",
  textAlign: "center" as const,
  marginBottom: "24px",
};

const replyRateLabel = {
  fontSize: "12px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 4px 0",
};

const replyRateValue = {
  fontSize: "32px",
  fontWeight: "700",
  color: colors.blue,
  margin: "0",
};

const ctaSection = {
  textAlign: "center" as const,
  marginBottom: "20px",
};

const ctaButton = {
  backgroundColor: colors.blue,
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
