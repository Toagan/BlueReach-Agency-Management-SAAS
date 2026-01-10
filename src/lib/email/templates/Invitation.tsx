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
  Img,
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
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

            :root { color-scheme: dark; }

            /* Mobile Responsive Styles */
            @media only screen and (max-width: 600px) {
              /* Main container */
              .main-section {
                padding: 32px 20px !important;
                border-radius: 16px !important;
              }

              /* Typography */
              .hero-title {
                font-size: 24px !important;
                line-height: 1.35 !important;
              }
              .hero-subtitle {
                font-size: 14px !important;
                line-height: 1.6 !important;
              }

              /* CTA Button - Full width on mobile */
              .cta-button {
                display: block !important;
                width: 100% !important;
                text-align: center !important;
                padding: 16px 20px !important;
                box-sizing: border-box !important;
              }

              /* Feature grid - Stack vertically */
              .feature-grid tr {
                display: block !important;
              }
              .feature-grid td {
                display: block !important;
                width: 100% !important;
                padding: 12px 0 !important;
                text-align: left !important;
              }

              /* Stats grid - Stack vertically */
              .stats-grid tr {
                display: block !important;
              }
              .stats-grid td {
                display: block !important;
                width: 100% !important;
                padding: 12px 0 !important;
                text-align: center !important;
              }
              .stats-grid .stat-divider {
                display: none !important;
              }

              /* Account card - Stack on mobile */
              .account-card-inner tr {
                display: block !important;
              }
              .account-card-inner td {
                display: block !important;
                width: 100% !important;
                text-align: left !important;
              }
              .account-card-inner td[align="right"] {
                text-align: left !important;
                padding-top: 12px !important;
              }

              /* Divider label */
              .divider-label {
                font-size: 9px !important;
                padding: 0 10px !important;
              }

              /* Footer */
              .footer-section {
                padding: 32px 16px !important;
              }
              .footer-brand {
                font-size: 16px !important;
              }
              .footer-links td {
                display: inline-block !important;
              }

              /* Link fallback */
              .link-fallback {
                font-size: 11px !important;
              }
            }

            /* Extra small devices */
            @media only screen and (max-width: 400px) {
              .main-section {
                padding: 24px 16px !important;
              }
              .hero-title {
                font-size: 22px !important;
              }
              .invite-badge {
                font-size: 10px !important;
                padding: 6px 12px !important;
              }
            }
          `}
        </style>
      </Head>
      <Preview>
        {firstName}, you've been invited to {clientName}'s dashboard on BlueReach
      </Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ══════════════════════════════════════════════════════════════════
              HEADER - Floating logo
          ══════════════════════════════════════════════════════════════════ */}
          <Section style={headerSection}>
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td align="center">
                  <table cellPadding="0" cellSpacing="0">
                    <tr>
                      <td style={logoIconCell}>
                        <div style={logoIcon}>🌊</div>
                      </td>
                      <td style={logoTextCell}>
                        <span style={logoText}>BlueReach</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              MAIN CARD
          ══════════════════════════════════════════════════════════════════ */}
          <Section style={mainCard} className="main-section">

            {/* Decorative gradient bar at top */}
            <div style={gradientBar}></div>

            {/* Invitation badge */}
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td align="center" style={{ paddingBottom: "32px" }}>
                  <span style={inviteBadge} className="invite-badge">
                    <span style={badgeDot}></span>
                    You&apos;re Invited
                  </span>
                </td>
              </tr>
            </table>

            {/* Hero content */}
            <Heading style={heroTitle} className="hero-title">
              Your campaign dashboard<br />
              for <span style={clientHighlight}>{clientName}</span><br />
              is ready
            </Heading>

            <Text style={heroSubtitle} className="hero-subtitle">
              {inviterName} has set up a dedicated workspace for you with
              real-time analytics, lead tracking, and campaign insights.
            </Text>

            {/* Primary CTA */}
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td align="center" style={{ padding: "8px 0 48px 0" }}>
                  <Button style={ctaButton} href={loginUrl} className="cta-button">
                    Open Dashboard
                    <span style={ctaArrow}>→</span>
                  </Button>
                </td>
              </tr>
            </table>

            {/* Divider with label */}
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td style={dividerLine}></td>
                <td style={dividerLabel} className="divider-label">DASHBOARD FEATURES</td>
                <td style={dividerLine}></td>
              </tr>
            </table>

            {/* Feature grid */}
            <table cellPadding="0" cellSpacing="0" width="100%" style={featureTable} className="feature-grid">
              <tr>
                <td style={featureCell}>
                  <div style={featureIconWrapper}>
                    <span style={featureIconText}>📊</span>
                  </div>
                  <Text style={featureTitle}>Analytics</Text>
                  <Text style={featureDesc}>Live campaign metrics & performance data</Text>
                </td>
                <td style={featureCell}>
                  <div style={featureIconWrapper}>
                    <span style={featureIconText}>🎯</span>
                  </div>
                  <Text style={featureTitle}>Lead Pipeline</Text>
                  <Text style={featureDesc}>Track prospects from contact to close</Text>
                </td>
              </tr>
              <tr>
                <td style={featureCell}>
                  <div style={featureIconWrapper}>
                    <span style={featureIconText}>💬</span>
                  </div>
                  <Text style={featureTitle}>Reply Management</Text>
                  <Text style={featureDesc}>View and respond to all messages</Text>
                </td>
                <td style={featureCell}>
                  <div style={featureIconWrapper}>
                    <span style={featureIconText}>📈</span>
                  </div>
                  <Text style={featureTitle}>ROI Tracking</Text>
                  <Text style={featureDesc}>Measure campaign revenue impact</Text>
                </td>
              </tr>
            </table>

            {/* Stats preview */}
            <table cellPadding="0" cellSpacing="0" width="100%" style={statsCard}>
              <tr>
                <td style={statsCardInner}>
                  <table cellPadding="0" cellSpacing="0" width="100%" className="stats-grid">
                    <tr>
                      <td style={statItem}>
                        <Text style={statNumber}>24/7</Text>
                        <Text style={statLabel}>Access</Text>
                      </td>
                      <td style={statDivider} className="stat-divider"></td>
                      <td style={statItem}>
                        <Text style={statNumber}>Real-time</Text>
                        <Text style={statLabel}>Updates</Text>
                      </td>
                      <td style={statDivider} className="stat-divider"></td>
                      <td style={statItem}>
                        <Text style={statNumber}>Secure</Text>
                        <Text style={statLabel}>Platform</Text>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            {/* Account info */}
            <table cellPadding="0" cellSpacing="0" width="100%" style={accountCard}>
              <tr>
                <td style={accountCardInner}>
                  <table cellPadding="0" cellSpacing="0" width="100%" className="account-card-inner">
                    <tr>
                      <td>
                        <Text style={accountLabel}>YOUR ACCOUNT</Text>
                        <Text style={accountEmail}>{recipientEmail}</Text>
                      </td>
                      <td align="right" style={{ verticalAlign: "middle" }}>
                        <span style={accountBadge}>Full Access</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            {/* Link fallback */}
            <Text style={linkFallback} className="link-fallback">
              Can&apos;t click the button? Copy this link:<br />
              <Link href={loginUrl} style={linkUrl}>{loginUrl}</Link>
            </Text>

          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              FOOTER
          ══════════════════════════════════════════════════════════════════ */}
          <Section style={footerSection} className="footer-section">
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td align="center">
                  <Text style={footerBrand} className="footer-brand">
                    <span style={footerWave}>🌊</span>BlueReach
                  </Text>
                  <Text style={footerTagline}>
                    B2B Lead Generation Platform
                  </Text>
                  <table cellPadding="0" cellSpacing="0" style={footerLinksTable} className="footer-links">
                    <tr>
                      <td>
                        <Link href={agencyWebsiteUrl} style={footerLink}>Website</Link>
                      </td>
                      <td style={footerLinkDot}>·</td>
                      <td>
                        <Link href="mailto:support@blue-reach.com" style={footerLink}>Support</Link>
                      </td>
                      <td style={footerLinkDot}>·</td>
                      <td>
                        <Link href={`${agencyWebsiteUrl}/privacy`} style={footerLink}>Privacy</Link>
                      </td>
                    </tr>
                  </table>
                  <Text style={footerCopyright}>
                    © {new Date().getFullYear()} BlueReach. All rights reserved.
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

// Plain text version
export function generatePlainText(props: InvitationEmailProps): string {
  return `
🌊 BLUEREACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU'RE INVITED

Your campaign dashboard for ${props.clientName} is ready.

${props.inviterName} has set up a dedicated workspace for you with
real-time analytics, lead tracking, and campaign insights.

▸ Open Dashboard: ${props.loginUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DASHBOARD FEATURES

📊 Analytics
   Live campaign metrics & performance data

🎯 Lead Pipeline
   Track prospects from contact to close

💬 Reply Management
   View and respond to all messages

📈 ROI Tracking
   Measure campaign revenue impact

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR ACCOUNT
${props.recipientEmail}
Access: Full Dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌊 BlueReach
B2B Lead Generation Platform
https://blue-reach.com

© ${new Date().getFullYear()} BlueReach. All rights reserved.
  `.trim();
}

export default InvitationEmail;

// ═══════════════════════════════════════════════════════════════════════════════
// BLUEREACH DESIGN SYSTEM - Premium Dark Mode
// ═══════════════════════════════════════════════════════════════════════════════

const colors = {
  // Core brand
  brand: "#0066FF",
  brandLight: "#3385FF",
  brandGlow: "rgba(0, 102, 255, 0.15)",

  // Backgrounds - Rich dark with slight blue tint
  bgDeep: "#05070A",
  bgBase: "#0A0D12",
  bgElevated: "#0F1318",
  bgCard: "#141920",
  bgHover: "#1A2028",

  // Borders
  borderSubtle: "#1E2530",
  borderDefault: "#2A3240",
  borderFocus: "#3A4555",

  // Text hierarchy
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B8C4",
  textTertiary: "#6B7585",
  textMuted: "#4A5565",

  // Accents
  cyan: "#00D4FF",
  cyanGlow: "rgba(0, 212, 255, 0.12)",
  green: "#00C853",
  greenGlow: "rgba(0, 200, 83, 0.12)",
};

// ─────────────────────────────────────────────────────────────────────────────
// BASE STYLES
// ─────────────────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: colors.bgDeep,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  margin: 0,
  padding: 0,
  WebkitFontSmoothing: "antialiased",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  maxWidth: "520px",
  padding: "0 16px",
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

const headerSection: React.CSSProperties = {
  padding: "40px 0 24px 0",
};

const logoIconCell: React.CSSProperties = {
  verticalAlign: "middle",
};

const logoIcon: React.CSSProperties = {
  fontSize: "28px",
  lineHeight: "1",
};

const logoTextCell: React.CSSProperties = {
  paddingLeft: "10px",
  verticalAlign: "middle",
};

const logoText: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: colors.textPrimary,
  letterSpacing: "-0.03em",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CARD
// ─────────────────────────────────────────────────────────────────────────────

const mainCard: React.CSSProperties = {
  backgroundColor: colors.bgElevated,
  borderRadius: "20px",
  border: `1px solid ${colors.borderSubtle}`,
  padding: "56px 48px",
  position: "relative" as const,
  overflow: "hidden",
};

const gradientBar: React.CSSProperties = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  height: "3px",
  background: `linear-gradient(90deg, ${colors.cyan} 0%, ${colors.brand} 50%, ${colors.cyan} 100%)`,
};

const inviteBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
  fontWeight: 600,
  color: colors.cyan,
  backgroundColor: colors.cyanGlow,
  padding: "8px 16px",
  borderRadius: "100px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const badgeDot: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  backgroundColor: colors.cyan,
  display: "inline-block",
};

const heroTitle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  color: colors.textPrimary,
  lineHeight: 1.3,
  margin: "0 0 20px 0",
  textAlign: "center" as const,
  letterSpacing: "-0.02em",
};

const clientHighlight: React.CSSProperties = {
  color: colors.brandLight,
};

const heroSubtitle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.7,
  color: colors.textSecondary,
  margin: "0 0 32px 0",
  textAlign: "center" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: colors.brand,
  borderRadius: "12px",
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "16px 32px",
  boxShadow: `0 8px 32px ${colors.brandGlow}, 0 2px 8px rgba(0,0,0,0.2)`,
};

const ctaArrow: React.CSSProperties = {
  fontSize: "18px",
  marginLeft: "4px",
};

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────────────────────

const dividerLine: React.CSSProperties = {
  height: "1px",
  backgroundColor: colors.borderSubtle,
  width: "100%",
};

const dividerLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: colors.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  padding: "0 16px",
  whiteSpace: "nowrap" as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────────────────

const featureTable: React.CSSProperties = {
  marginTop: "32px",
  marginBottom: "32px",
};

const featureCell: React.CSSProperties = {
  width: "50%",
  padding: "16px 12px",
  verticalAlign: "top" as const,
};

const featureIconWrapper: React.CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  backgroundColor: colors.bgCard,
  border: `1px solid ${colors.borderSubtle}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "14px",
  lineHeight: "44px",
  textAlign: "center" as const,
};

const featureIconText: React.CSSProperties = {
  fontSize: "20px",
};

const featureTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: colors.textPrimary,
  margin: "0 0 6px 0",
};

const featureDesc: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.5,
  color: colors.textTertiary,
  margin: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS CARD
// ─────────────────────────────────────────────────────────────────────────────

const statsCard: React.CSSProperties = {
  backgroundColor: colors.bgCard,
  borderRadius: "14px",
  border: `1px solid ${colors.borderSubtle}`,
  marginBottom: "20px",
};

const statsCardInner: React.CSSProperties = {
  padding: "24px 20px",
};

const statItem: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "0 12px",
};

const statNumber: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: colors.textPrimary,
  margin: "0 0 4px 0",
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: colors.textTertiary,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: 0,
};

const statDivider: React.CSSProperties = {
  width: "1px",
  backgroundColor: colors.borderSubtle,
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT CARD
// ─────────────────────────────────────────────────────────────────────────────

const accountCard: React.CSSProperties = {
  backgroundColor: colors.bgCard,
  borderRadius: "14px",
  border: `1px solid ${colors.borderSubtle}`,
  marginBottom: "28px",
};

const accountCardInner: React.CSSProperties = {
  padding: "20px 24px",
};

const accountLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: colors.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0 0 6px 0",
};

const accountEmail: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: colors.textPrimary,
  margin: 0,
};

const accountBadge: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: colors.green,
  backgroundColor: colors.greenGlow,
  padding: "6px 12px",
  borderRadius: "8px",
  display: "inline-block",
};

// ─────────────────────────────────────────────────────────────────────────────
// LINK FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

const linkFallback: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.6,
  color: colors.textMuted,
  textAlign: "center" as const,
  margin: 0,
};

const linkUrl: React.CSSProperties = {
  color: colors.brandLight,
  textDecoration: "none",
  wordBreak: "break-all" as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

const footerSection: React.CSSProperties = {
  padding: "40px 24px",
};

const footerBrand: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: colors.textPrimary,
  margin: "0 0 6px 0",
  letterSpacing: "-0.02em",
};

const footerWave: React.CSSProperties = {
  marginRight: "6px",
};

const footerTagline: React.CSSProperties = {
  fontSize: "13px",
  color: colors.textTertiary,
  margin: "0 0 20px 0",
};

const footerLinksTable: React.CSSProperties = {
  margin: "0 auto 20px auto",
};

const footerLink: React.CSSProperties = {
  fontSize: "12px",
  color: colors.textSecondary,
  textDecoration: "none",
};

const footerLinkDot: React.CSSProperties = {
  color: colors.textMuted,
  padding: "0 10px",
  fontSize: "12px",
};

const footerCopyright: React.CSSProperties = {
  fontSize: "11px",
  color: colors.textMuted,
  margin: 0,
};
