import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface SlackWebhookSetupProps {
  recipientName: string;
  clientName: string;
  agencyName: string;
  dashboardUrl: string;
}

export const SlackWebhookSetup = ({
  recipientName = "there",
  clientName = "Your Company",
  agencyName = "BlueReach",
  dashboardUrl = "https://app.blue-reach.com",
}: SlackWebhookSetupProps) => {
  const firstName = recipientName.split(" ")[0] || "there";

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>
        Set up Slack notifications for {clientName} campaign updates
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerBrand}>
              <span style={headerWave}>🌊</span> {agencyName}
            </Text>
          </Section>

          {/* Main Content */}
          <Section style={main}>
            <Heading style={heading}>
              Set Up Slack Notifications
            </Heading>

            <Text style={subtext}>
              Hey {firstName}, we can send real-time campaign notifications directly to your Slack channel.
              Follow these steps to connect your workspace:
            </Text>

            {/* Steps */}
            <table cellPadding="0" cellSpacing="0" border={0} style={stepsContainer}>
              <tbody>
                {[
                  { num: "1", title: "Create a Slack App", desc: <>Go to <strong>api.slack.com/apps</strong> and click &quot;Create New App&quot; &rarr; &quot;From scratch&quot;. Name it something like &quot;{agencyName} Notifications&quot; and select your workspace.</> },
                  { num: "2", title: "Enable Incoming Webhooks", desc: <>In your app settings, go to &quot;Incoming Webhooks&quot; in the sidebar and toggle it <strong>On</strong>.</> },
                  { num: "3", title: "Add to Channel", desc: <>Click &quot;Add New Webhook to Workspace&quot; and select the channel where you want to receive notifications.</> },
                  { num: "4", title: "Copy the Webhook URL", desc: <>Copy the webhook URL that starts with <strong>https://hooks.slack.com/services/...</strong></> },
                  { num: "5", title: "Paste in Dashboard Settings", desc: <>Go to your dashboard settings and paste the webhook URL in the Slack Notifications section.</> },
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
              Once connected, you&#39;ll receive notifications for positive replies and periodic stats reports.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerBrand}>
              <span style={footerWave}>🌊</span> {agencyName}
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} {agencyName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export function generateSlackSetupPlainText(props: SlackWebhookSetupProps): string {
  const firstName = props.recipientName.split(" ")[0] || "there";

  return `
${props.agencyName} - SET UP SLACK NOTIFICATIONS

Hey ${firstName}, we can send real-time campaign notifications directly to your Slack channel.

SETUP STEPS:

1. CREATE A SLACK APP
   Go to api.slack.com/apps and click "Create New App" > "From scratch".
   Name it "${props.agencyName} Notifications" and select your workspace.

2. ENABLE INCOMING WEBHOOKS
   In your app settings, go to "Incoming Webhooks" and toggle it On.

3. ADD TO CHANNEL
   Click "Add New Webhook to Workspace" and select the channel.

4. COPY THE WEBHOOK URL
   Copy the URL starting with https://hooks.slack.com/services/...

5. PASTE IN DASHBOARD SETTINGS
   Go to your dashboard settings and paste the webhook URL.

Go to Dashboard Settings: ${props.dashboardUrl}

Once connected, you'll receive notifications for positive replies and periodic stats reports.

© ${new Date().getFullYear()} ${props.agencyName}
  `.trim();
}

export default SlackWebhookSetup;

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
