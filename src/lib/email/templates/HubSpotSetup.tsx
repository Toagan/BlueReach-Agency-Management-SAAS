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

export interface HubSpotSetupProps {
  recipientName: string;
  clientName: string;
  agencyName: string;
  dashboardUrl: string;
}

export const HubSpotSetup = ({
  recipientName = "there",
  clientName = "Your Company",
  agencyName = "BlueReach",
  dashboardUrl = "https://app.blue-reach.com",
}: HubSpotSetupProps) => {
  const firstName = recipientName.split(" ")[0] || "there";

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>
        Connect HubSpot CRM for {clientName} campaign sync
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerBrand}>
              <span style={headerWave}>&#127754;</span> {agencyName}
            </Text>
          </Section>

          {/* Main Content */}
          <Section style={main}>
            <Heading style={heading}>
              Connect HubSpot CRM
            </Heading>

            <Text style={subtext}>
              Hey {firstName}, we need to connect your HubSpot account so positive replies sync automatically.
              Follow these steps to create a Private App and share the access token:
            </Text>

            {/* Steps */}
            <table cellPadding="0" cellSpacing="0" border={0} style={stepsContainer}>
              <tbody>
                {[
                  { num: "1", title: "Open Private Apps", desc: <>Go to <strong>HubSpot &rarr; Settings &rarr; Integrations &rarr; Private Apps</strong>.</> },
                  { num: "2", title: "Create a Private App", desc: <>Click &quot;Create a Private App&quot; and name it something like &quot;{agencyName} Sync&quot;.</> },
                  { num: "3", title: "Set Scopes", desc: <>Go to the &quot;Scopes&quot; tab, search and enable: <strong>crm.objects.contacts.read</strong>, <strong>crm.objects.contacts.write</strong>, <strong>crm.objects.deals.read</strong>, <strong>crm.objects.deals.write</strong>.</> },
                  { num: "4", title: "Create & Copy Token", desc: <>Click &quot;Create App&quot;, confirm, then copy the access token that starts with <strong>pat-...</strong></> },
                  { num: "5", title: "Paste in Dashboard", desc: <>Go to your dashboard settings and paste the token in the CRM Integration section.</> },
                ].map((s) => (
                  <tr key={s.num}>
                    <td style={stepNumberCell}>
                      <div style={stepNumber}>{s.num}</div>
                    </td>
                    <td style={stepContentCell}>
                      <Text style={stepTitle}>{s.title}</Text>
                      <Text style={stepDescription}>{s.desc}</Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* CTA */}
            <Section style={ctaSection}>
              <Button style={ctaButton} href={dashboardUrl}>
                Go to Dashboard Settings
              </Button>
            </Section>

            <Text style={tipText}>
              Once connected, positive replies will automatically create contacts and deals in your HubSpot CRM.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerBrand}>
              <span style={footerWave}>&#127754;</span> {agencyName}
            </Text>
            <Text style={copyright}>
              &copy; {new Date().getFullYear()} {agencyName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export function generateHubSpotSetupPlainText(props: HubSpotSetupProps): string {
  const firstName = props.recipientName.split(" ")[0] || "there";

  return `
${props.agencyName} - CONNECT HUBSPOT CRM

Hey ${firstName}, we need to connect your HubSpot account so positive replies sync automatically.

SETUP STEPS:

1. OPEN PRIVATE APPS
   Go to HubSpot > Settings > Integrations > Private Apps.

2. CREATE A PRIVATE APP
   Click "Create a Private App" and name it "${props.agencyName} Sync".

3. SET SCOPES
   Go to the "Scopes" tab, search and enable:
   - crm.objects.contacts.read
   - crm.objects.contacts.write
   - crm.objects.deals.read
   - crm.objects.deals.write

4. CREATE & COPY TOKEN
   Click "Create App", confirm, then copy the access token (starts with pat-...).

5. PASTE IN DASHBOARD
   Go to your dashboard settings and paste the token in the CRM Integration section.

Go to Dashboard Settings: ${props.dashboardUrl}

Once connected, positive replies will automatically create contacts and deals in your HubSpot CRM.

\u00a9 ${new Date().getFullYear()} ${props.agencyName}
  `.trim();
}

export default HubSpotSetup;

// Styles
const colors = {
  navy: "#0A1628",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
  blueDark: "#1E40AF",
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
  maxWidth: "600px",
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

const stepsContainer = {
  width: "100%" as const,
  marginBottom: "24px",
};

const stepNumberCell = {
  width: "40px",
  verticalAlign: "top" as const,
  paddingBottom: "16px",
};

const stepNumber = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  backgroundColor: colors.blue,
  color: colors.white,
  fontSize: "14px",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  lineHeight: "28px",
};

const stepContentCell = {
  verticalAlign: "top" as const,
  paddingBottom: "16px",
};

const stepTitle = {
  fontSize: "14px",
  fontWeight: "600",
  color: colors.gray800,
  margin: "0 0 4px 0",
};

const stepDescription = {
  fontSize: "13px",
  color: colors.gray600,
  margin: "0",
  lineHeight: "1.5",
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

const copyright = {
  fontSize: "11px",
  color: colors.gray400,
  margin: "0",
};
