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
  agencyWebsiteUrl = "https://blue-reach.com",
  loginUrl = "https://app.blue-reach.com/login",
  recipientEmail = "user@example.com",
}: InvitationEmailProps) => {
  const firstName = inviteeName.split(" ")[0] || "there";

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

            @media only screen and (max-width: 600px) {
              .mobile-pad { padding: 32px 24px !important; }
              .hero-title { font-size: 36px !important; }
              .cta-btn { width: 100% !important; }
              .feature-cell { display: block !important; width: 100% !important; padding: 12px 0 !important; }
            }
          `}
        </style>
      </Head>
      <Preview>
        {firstName}, your {clientName} dashboard is ready
      </Preview>
      <Body style={body}>
        <Container style={wrapper}>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* DARK HERO */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Section style={hero}>
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td style={heroInner} className="mobile-pad">

                  {/* Wave Icon + Brand */}
                  <table cellPadding="0" cellSpacing="0" style={brandRow}>
                    <tr>
                      <td>
                        <div style={waveIcon}>
                          <span style={waveEmoji}>🌊</span>
                        </div>
                      </td>
                      <td style={brandTextCell}>
                        <Text style={brandText}>BlueReach</Text>
                      </td>
                    </tr>
                  </table>

                  {/* Headline */}
                  <Heading style={heroTitle} className="hero-title">
                    Your Dashboard<br />is Ready
                  </Heading>

                  <Text style={heroSub}>
                    <strong style={heroHighlight}>{inviterName}</strong> invited you to access
                    <br />
                    <strong style={heroHighlight}>{clientName}</strong>&apos;s campaign dashboard
                  </Text>

                  {/* CTA */}
                  <table cellPadding="0" cellSpacing="0" style={ctaRow}>
                    <tr>
                      <td>
                        <Button style={ctaBtn} href={loginUrl} className="cta-btn">
                          Access Dashboard →
                        </Button>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
          </Section>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* CONTENT CARD */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Section style={card} className="mobile-pad">

            <Text style={sectionLabel}>WHAT YOU GET</Text>

            <table cellPadding="0" cellSpacing="0" style={featureGrid}>
              <tr>
                <td style={featureCell} className="feature-cell">
                  <Text style={featureIcon}>📊</Text>
                  <Text style={featureTitle}>Analytics</Text>
                  <Text style={featureDesc}>Real-time metrics</Text>
                </td>
                <td style={featureCell} className="feature-cell">
                  <Text style={featureIcon}>📈</Text>
                  <Text style={featureTitle}>Pipeline</Text>
                  <Text style={featureDesc}>Lead tracking</Text>
                </td>
                <td style={featureCell} className="feature-cell">
                  <Text style={featureIcon}>💬</Text>
                  <Text style={featureTitle}>Replies</Text>
                  <Text style={featureDesc}>Response monitoring</Text>
                </td>
                <td style={featureCell} className="feature-cell">
                  <Text style={featureIcon}>📧</Text>
                  <Text style={featureTitle}>Threads</Text>
                  <Text style={featureDesc}>Full history</Text>
                </td>
              </tr>
            </table>

            <div style={divider}></div>

            {/* Info Rows */}
            <table cellPadding="0" cellSpacing="0" style={infoTable}>
              <tr>
                <td style={infoCell}>
                  <Text style={infoLabel}>Client</Text>
                  <Text style={infoValue}>{clientName}</Text>
                </td>
                <td style={infoCell}>
                  <Text style={infoLabel}>Access</Text>
                  <Text style={infoBadge}>Full Dashboard</Text>
                </td>
              </tr>
            </table>

            {/* Secondary CTA */}
            <table cellPadding="0" cellSpacing="0" style={secondaryCtaRow}>
              <tr>
                <td>
                  <Button style={secondaryCta} href={loginUrl}>
                    Open Dashboard
                  </Button>
                </td>
              </tr>
            </table>

            <Text style={linkNote}>
              Or copy: <Link href={loginUrl} style={linkUrl}>{loginUrl}</Link>
            </Text>

          </Section>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* FOOTER */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Section style={footer}>

            {/* Partners */}
            <table cellPadding="0" cellSpacing="0" style={partnerBox}>
              <tr>
                <td style={partnerInner}>
                  <Text style={partnerLabel}>POWERED BY</Text>
                  <Text style={partnerNames}>
                    <span style={partnerName}>Instantly</span>
                    <span style={partnerAnd}>&</span>
                    <span style={partnerName}>Clay</span>
                  </Text>
                </td>
              </tr>
            </table>

            {/* Brand Footer */}
            <Text style={footerBrand}>
              <span style={footerWave}>🌊</span> BlueReach
            </Text>

            <Text style={footerLinks}>
              <Link href={agencyWebsiteUrl} style={footerLink}>Website</Link>
              <span style={footerDot}> · </span>
              <Link href="mailto:support@blue-reach.com" style={footerLink}>Support</Link>
            </Text>

            <Text style={copyright}>
              © {new Date().getFullYear()} BlueReach · B2B Lead Generation
            </Text>

            <Text style={sentTo}>
              Sent to {recipientEmail}
            </Text>

          </Section>

        </Container>
      </Body>
    </Html>
  );
};

// Plain text
export function generatePlainText(props: InvitationEmailProps): string {
  const firstName = props.inviteeName.split(" ")[0] || "there";
  return `
🌊 BLUEREACH

YOUR DASHBOARD IS READY

${props.inviterName} invited you to access
${props.clientName}'s campaign dashboard

→ ${props.loginUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT YOU GET:
📊 Analytics - Real-time metrics
📈 Pipeline - Lead tracking
💬 Replies - Response monitoring
📧 Threads - Full history

Client: ${props.clientName}
Access: Full Dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Powered by Instantly & Clay

🌊 BlueReach
B2B Lead Generation
© ${new Date().getFullYear()}

Sent to ${props.recipientEmail}
  `.trim();
}

export default InvitationEmail;

// ═══════════════════════════════════════════════════════════════════════════
// DARK BLUE DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  // Dark blues
  navy: "#0A1628",
  navyLight: "#0F2140",
  navyMid: "#1A3A5C",

  // Accent blues
  blue: "#3B82F6",
  blueLight: "#60A5FA",
  blueBright: "#93C5FD",

  // Cyan accents
  cyan: "#22D3EE",
  cyanLight: "#67E8F9",

  // Neutrals
  white: "#FFFFFF",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
};

// ─────────────────────────────────────────────────────────────────────────
// BASE
// ─────────────────────────────────────────────────────────────────────────

const body = {
  backgroundColor: colors.gray100,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: "0",
  padding: "0",
};

const wrapper = {
  margin: "0 auto",
  maxWidth: "600px",
  padding: "0",
};

// ─────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────

const hero = {
  backgroundColor: colors.navy,
  backgroundImage: `linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyLight} 50%, ${colors.navyMid} 100%)`,
  borderRadius: "0 0 20px 20px",
};

const heroInner = {
  padding: "48px 40px 56px 40px",
  textAlign: "center" as const,
};

const brandRow = {
  margin: "0 auto 40px auto",
};

const waveIcon = {
  width: "52px",
  height: "52px",
  borderRadius: "14px",
  backgroundColor: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.15)",
  display: "inline-block",
  textAlign: "center" as const,
  verticalAlign: "middle",
};

const waveEmoji = {
  fontSize: "28px",
  lineHeight: "52px",
  display: "block",
};

const brandTextCell = {
  paddingLeft: "14px",
  verticalAlign: "middle" as const,
};

const brandText = {
  fontSize: "24px",
  fontWeight: "700",
  color: colors.white,
  margin: "0",
  letterSpacing: "-0.02em",
};

const heroTitle = {
  fontSize: "42px",
  fontWeight: "800",
  color: colors.white,
  lineHeight: "1.1",
  margin: "0 0 24px 0",
  letterSpacing: "-0.03em",
};

const heroSub = {
  fontSize: "16px",
  lineHeight: "1.7",
  color: colors.gray400,
  margin: "0 0 36px 0",
};

const heroHighlight = {
  color: colors.white,
};

const ctaRow = {
  margin: "0 auto",
};

const ctaBtn = {
  backgroundColor: colors.cyan,
  borderRadius: "10px",
  color: colors.navy,
  fontSize: "15px",
  fontWeight: "700",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "16px 36px",
  boxShadow: `0 4px 20px ${colors.cyan}50`,
};

// ─────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────

const card = {
  backgroundColor: colors.white,
  borderRadius: "16px",
  padding: "36px 32px",
  margin: "-24px 16px 0 16px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  border: `1px solid ${colors.gray200}`,
  position: "relative" as const,
  zIndex: "10",
};

const sectionLabel = {
  fontSize: "11px",
  fontWeight: "700",
  color: colors.blue,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  margin: "0 0 20px 0",
  textAlign: "center" as const,
};

// ─────────────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────────────

const featureGrid = {
  width: "100%",
  marginBottom: "24px",
};

const featureCell = {
  width: "25%",
  textAlign: "center" as const,
  padding: "0 8px",
  verticalAlign: "top" as const,
};

const featureIcon = {
  fontSize: "28px",
  margin: "0 0 8px 0",
};

const featureTitle = {
  fontSize: "13px",
  fontWeight: "700",
  color: colors.gray800,
  margin: "0 0 2px 0",
};

const featureDesc = {
  fontSize: "11px",
  color: colors.gray500,
  margin: "0",
};

// ─────────────────────────────────────────────────────────────────────────
// INFO
// ─────────────────────────────────────────────────────────────────────────

const divider = {
  height: "1px",
  backgroundColor: colors.gray200,
  margin: "0 0 24px 0",
};

const infoTable = {
  width: "100%",
  marginBottom: "28px",
};

const infoCell = {
  width: "50%",
  padding: "12px 16px",
  backgroundColor: colors.gray100,
  borderRadius: "10px",
  verticalAlign: "top" as const,
};

const infoLabel = {
  fontSize: "11px",
  fontWeight: "600",
  color: colors.gray500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 4px 0",
};

const infoValue = {
  fontSize: "14px",
  fontWeight: "700",
  color: colors.gray800,
  margin: "0",
};

const infoBadge = {
  fontSize: "12px",
  fontWeight: "700",
  color: colors.blue,
  backgroundColor: `${colors.blue}15`,
  padding: "4px 12px",
  borderRadius: "20px",
  display: "inline-block",
  margin: "0",
};

// ─────────────────────────────────────────────────────────────────────────
// SECONDARY CTA
// ─────────────────────────────────────────────────────────────────────────

const secondaryCtaRow = {
  textAlign: "center" as const,
  marginBottom: "16px",
};

const secondaryCta = {
  backgroundColor: colors.navy,
  borderRadius: "10px",
  color: colors.white,
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 28px",
};

const linkNote = {
  fontSize: "12px",
  color: colors.gray400,
  textAlign: "center" as const,
  margin: "0",
};

const linkUrl = {
  color: colors.blue,
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

// ─────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────

const footer = {
  padding: "28px 24px",
  textAlign: "center" as const,
};

const partnerBox = {
  margin: "0 auto 20px auto",
  backgroundColor: colors.white,
  borderRadius: "10px",
  border: `1px solid ${colors.gray200}`,
  width: "auto",
  display: "inline-block",
};

const partnerInner = {
  padding: "16px 32px",
  textAlign: "center" as const,
};

const partnerLabel = {
  fontSize: "9px",
  fontWeight: "700",
  color: colors.gray400,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  margin: "0 0 8px 0",
};

const partnerNames = {
  fontSize: "14px",
  margin: "0",
};

const partnerName = {
  fontWeight: "700",
  color: colors.gray700,
};

const partnerAnd = {
  color: colors.gray400,
  margin: "0 8px",
  fontWeight: "400",
};

const footerBrand = {
  fontSize: "16px",
  fontWeight: "700",
  color: colors.gray800,
  margin: "0 0 8px 0",
};

const footerWave = {
  marginRight: "4px",
};

const footerLinks = {
  fontSize: "13px",
  margin: "0 0 12px 0",
};

const footerLink = {
  color: colors.gray500,
  textDecoration: "none",
};

const footerDot = {
  color: colors.gray300,
};

const copyright = {
  fontSize: "11px",
  color: colors.gray400,
  margin: "0 0 4px 0",
};

const sentTo = {
  fontSize: "10px",
  color: colors.gray400,
  margin: "0",
};
