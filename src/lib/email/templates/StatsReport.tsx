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
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";

export interface StatsReportProps {
  recipientName: string;
  clientName: string;
  periodLabel: string; // e.g., "Weekly", "Monthly", "All-Time"
  periodRange: string; // e.g., "Dec 30 - Jan 5"
  stats: {
    emailsSent: number; // Actually leads contacted
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

  // Calculate positive reply rate (most important metric)
  const positiveReplyRate = stats.emailsSent > 0
    ? ((stats.positiveReplies / stats.emailsSent) * 100).toFixed(2)
    : "0.00";

  // Calculate changes from previous period
  const getChange = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const leadsChange = previousStats ? getChange(stats.emailsSent, previousStats.emailsSent) : null;
  const repliesChange = previousStats ? getChange(stats.replies, previousStats.replies) : null;
  const positiveChange = previousStats ? getChange(stats.positiveReplies, previousStats.positiveReplies) : null;

  const formatChange = (change: number | null) => {
    if (change === null) return null;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(0)}%`;
  };

  // Format period description
  const getPeriodDescription = () => {
    if (periodLabel === "All-Time") {
      return `all-time performance`;
    }
    return `${periodLabel.toLowerCase()} performance (${periodRange})`;
  };

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>
        {periodLabel} Report: {clientName} - {positiveReplyRate}% positive reply rate ({stats.positiveReplies} interested leads)
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
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: "20px" }}>
              <tr>
                <td>
                  <span style={reportBadge}>
                    <span style={reportIcon}>📊</span>
                    <span style={reportText}>{periodLabel} Stats Report</span>
                  </span>
                </td>
              </tr>
            </table>

            {/* Greeting & Summary */}
            <Heading style={heading}>
              Hey {firstName}!
            </Heading>

            <Text style={subtext}>
              Here&apos;s your {getPeriodDescription()} for <strong>{clientName}</strong>.
            </Text>

            {/* Hero Metric - Positive Reply Rate */}
            <table width="100%" cellPadding="0" cellSpacing="0" style={heroBox}>
              <tr>
                <td align="center">
                  <Text style={heroIcon}>🎯</Text>
                  <Text style={heroValue}>{positiveReplyRate}%</Text>
                  <Text style={heroLabel}>POSITIVE REPLY RATE</Text>
                  <Text style={heroSubtext}>
                    {stats.positiveReplies.toLocaleString()} of {stats.emailsSent.toLocaleString()} leads showed interest
                  </Text>
                  {positiveChange !== null && (
                    <Text style={positiveChange >= 0 ? heroChangePositive : heroChangeNegative}>
                      {formatChange(positiveChange)} vs previous period
                    </Text>
                  )}
                </td>
              </tr>
            </table>

            {/* Stats Grid - Table based for email client compatibility */}
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: "24px" }}>
              <tr>
                {/* Leads Contacted */}
                <td width="33%" style={statCell}>
                  <table width="100%" cellPadding="0" cellSpacing="0" style={statCard}>
                    <tr>
                      <td align="center">
                        <Text style={statIconStyle}>📧</Text>
                        <Text style={statValue}>{stats.emailsSent.toLocaleString()}</Text>
                        <Text style={statLabel}>Leads Contacted</Text>
                        {leadsChange !== null && (
                          <Text style={leadsChange >= 0 ? statChangePositive : statChangeNegative}>
                            {formatChange(leadsChange)}
                          </Text>
                        )}
                      </td>
                    </tr>
                  </table>
                </td>

                {/* Total Replies */}
                <td width="33%" style={statCell}>
                  <table width="100%" cellPadding="0" cellSpacing="0" style={statCard}>
                    <tr>
                      <td align="center">
                        <Text style={statIconStyle}>💬</Text>
                        <Text style={statValue}>{stats.replies.toLocaleString()}</Text>
                        <Text style={statLabel}>Total Replies</Text>
                        {repliesChange !== null && (
                          <Text style={repliesChange >= 0 ? statChangePositive : statChangeNegative}>
                            {formatChange(repliesChange)}
                          </Text>
                        )}
                      </td>
                    </tr>
                  </table>
                </td>

                {/* Positive Replies */}
                <td width="33%" style={statCell}>
                  <table width="100%" cellPadding="0" cellSpacing="0" style={statCardHighlight}>
                    <tr>
                      <td align="center">
                        <Text style={statIconStyle}>✅</Text>
                        <Text style={statValueHighlight}>{stats.positiveReplies.toLocaleString()}</Text>
                        <Text style={statLabelHighlight}>Positive Replies</Text>
                        {positiveChange !== null && (
                          <Text style={positiveChange >= 0 ? statChangePositiveAlt : statChangeNegativeAlt}>
                            {formatChange(positiveChange)}
                          </Text>
                        )}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            {/* Reply Rate (secondary) */}
            <table width="100%" cellPadding="0" cellSpacing="0" style={replyRateBox}>
              <tr>
                <td align="center">
                  <Text style={replyRateLabel}>Overall Reply Rate</Text>
                  <Text style={replyRateValue}>{stats.replyRate.toFixed(1)}%</Text>
                </td>
              </tr>
            </table>

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
  const positiveReplyRate = props.stats.emailsSent > 0
    ? ((props.stats.positiveReplies / props.stats.emailsSent) * 100).toFixed(2)
    : "0.00";

  const periodDesc = props.periodLabel === "All-Time"
    ? "all-time performance"
    : `${props.periodLabel.toLowerCase()} performance (${props.periodRange})`;

  return `
🌊 BLUEREACH - ${props.periodLabel.toUpperCase()} STATS REPORT

Hey ${firstName}!

Here's your ${periodDesc} for ${props.clientName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 POSITIVE REPLY RATE: ${positiveReplyRate}%
   ${props.stats.positiveReplies.toLocaleString()} of ${props.stats.emailsSent.toLocaleString()} leads showed interest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 LEADS CONTACTED: ${props.stats.emailsSent.toLocaleString()}
💬 TOTAL REPLIES: ${props.stats.replies.toLocaleString()}
✅ POSITIVE REPLIES: ${props.stats.positiveReplies.toLocaleString()}

📈 OVERALL REPLY RATE: ${props.stats.replyRate.toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View Full Dashboard: ${props.dashboardUrl}

Keep the momentum going! Consistent outreach leads to consistent results.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  greenDark: "#059669",
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

const body: React.CSSProperties = {
  backgroundColor: colors.gray100,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: "0",
  padding: "0",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  maxWidth: "540px",
  padding: "20px",
};

const header: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0",
};

const headerBrand: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "700",
  color: colors.navy,
  margin: "0",
};

const headerWave: React.CSSProperties = {
  marginRight: "6px",
};

const main: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const reportBadge: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: colors.blueLight,
  borderRadius: "20px",
  padding: "8px 16px",
};

const reportIcon: React.CSSProperties = {
  marginRight: "8px",
};

const reportText: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: colors.blueDark,
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: colors.gray800,
  lineHeight: "1.3",
  margin: "0 0 8px 0",
};

const subtext: React.CSSProperties = {
  fontSize: "15px",
  color: colors.gray600,
  margin: "0 0 24px 0",
  lineHeight: "1.5",
};

// Hero metric styles
const heroBox: React.CSSProperties = {
  backgroundColor: colors.greenLight,
  borderRadius: "16px",
  padding: "24px",
  marginBottom: "24px",
  border: `2px solid ${colors.green}`,
};

const heroIcon: React.CSSProperties = {
  fontSize: "32px",
  margin: "0 0 8px 0",
};

const heroValue: React.CSSProperties = {
  fontSize: "48px",
  fontWeight: "800",
  color: colors.greenDark,
  margin: "0",
  lineHeight: "1",
};

const heroLabel: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: colors.greenDark,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  margin: "8px 0 4px 0",
};

const heroSubtext: React.CSSProperties = {
  fontSize: "14px",
  color: colors.gray600,
  margin: "0",
};

const heroChangePositive: React.CSSProperties = {
  fontSize: "13px",
  color: colors.green,
  fontWeight: "600",
  margin: "8px 0 0 0",
};

const heroChangeNegative: React.CSSProperties = {
  fontSize: "13px",
  color: colors.red,
  fontWeight: "600",
  margin: "8px 0 0 0",
};

// Stats grid styles
const statCell: React.CSSProperties = {
  padding: "0 6px",
};

const statCard: React.CSSProperties = {
  backgroundColor: colors.gray100,
  borderRadius: "12px",
  padding: "16px 8px",
};

const statCardHighlight: React.CSSProperties = {
  backgroundColor: colors.blueLight,
  borderRadius: "12px",
  padding: "16px 8px",
};

const statIconStyle: React.CSSProperties = {
  fontSize: "20px",
  margin: "0 0 8px 0",
};

const statValue: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: colors.gray800,
  lineHeight: "1",
  margin: "0 0 4px 0",
};

const statValueHighlight: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: colors.blueDark,
  lineHeight: "1",
  margin: "0 0 4px 0",
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  margin: "0",
};

const statLabelHighlight: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "600",
  color: colors.blueDark,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  margin: "0",
};

const statChangePositive: React.CSSProperties = {
  fontSize: "11px",
  color: colors.green,
  margin: "4px 0 0 0",
};

const statChangeNegative: React.CSSProperties = {
  fontSize: "11px",
  color: colors.red,
  margin: "4px 0 0 0",
};

const statChangePositiveAlt: React.CSSProperties = {
  fontSize: "11px",
  color: colors.green,
  fontWeight: "600",
  margin: "4px 0 0 0",
};

const statChangeNegativeAlt: React.CSSProperties = {
  fontSize: "11px",
  color: colors.red,
  fontWeight: "600",
  margin: "4px 0 0 0",
};

const replyRateBox: React.CSSProperties = {
  backgroundColor: colors.gray100,
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "24px",
};

const replyRateLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0 0 4px 0",
};

const replyRateValue: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "700",
  color: colors.blue,
  margin: "0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "20px",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: colors.blue,
  borderRadius: "10px",
  color: colors.white,
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
  padding: "14px 32px",
};

const tipText: React.CSSProperties = {
  fontSize: "13px",
  color: colors.gray500,
  textAlign: "center",
  margin: "0",
};

const footer: React.CSSProperties = {
  padding: "24px",
  textAlign: "center",
};

const footerBrand: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: colors.gray600,
  margin: "0 0 8px 0",
};

const footerWave: React.CSSProperties = {
  marginRight: "4px",
};

const footerLinks: React.CSSProperties = {
  fontSize: "13px",
  margin: "0 0 8px 0",
};

const footerLink: React.CSSProperties = {
  color: colors.gray500,
  textDecoration: "none",
};

const footerDot: React.CSSProperties = {
  color: colors.gray400,
};

const copyright: React.CSSProperties = {
  fontSize: "11px",
  color: colors.gray400,
  margin: "0",
};
