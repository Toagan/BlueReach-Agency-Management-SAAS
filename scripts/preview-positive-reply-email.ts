/**
 * Preview positive reply notification email as local HTML file
 *
 * Usage: npx tsx scripts/preview-positive-reply-email.ts
 * Opens the rendered email in your browser
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { render } from "@react-email/render";
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import {
  PositiveReplyNotification,
} from "../src/lib/email/templates/PositiveReplyNotification";
import { buildReplyUrl } from "../src/lib/email/send";

async function main() {
  const sampleThread = [
    {
      direction: "outbound" as const,
      from_email: "tilman@blue-reach.com",
      to_email: "max.mustermann@autohaus-example.de",
      subject: "Mehr Neukunden für Autohaus Mustermann?",
      body_text:
        "Hallo Herr Mustermann,\n\nich bin Tilman von Blue Reach. Wir helfen Autohäusern dabei, gezielt neue Kunden in Ihrer Region zu gewinnen — ohne Streuverlust.\n\nAktuell arbeiten wir mit mehreren Autohäusern im Raum Nürnberg zusammen und generieren dort durchschnittlich 15-20 qualifizierte Anfragen pro Monat.\n\nHätten Sie Interesse an einem kurzen Austausch dazu?\n\nBeste Grüße,\nTilman Schepke\nBlue Reach",
      body_html: null,
      sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      direction: "inbound" as const,
      from_email: "max.mustermann@autohaus-example.de",
      to_email: "tilman@blue-reach.com",
      subject: "Re: Mehr Neukunden für Autohaus Mustermann?",
      body_text:
        "Hallo Herr Schepke,\n\nvielen Dank für Ihre Nachricht! Das klingt sehr interessant. Wir haben tatsächlich gerade Bedarf an neuen Kunden, besonders im Bereich Gebrauchtwagen.\n\nKönnten wir diese Woche einen kurzen Termin vereinbaren? Ich bin Dienstag und Donnerstag nachmittags verfügbar.\n\nMit freundlichen Grüßen,\nMax Mustermann\nAutohaus Mustermann GmbH\n+49 911 123 4567",
      body_html: null,
      sent_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const baseUrl = "http://localhost:3000";
  const composeParams = {
    leadEmail: "max.mustermann@autohaus-example.de",
    leadName: "Max Mustermann",
    originalSubject: "Mehr Neukunden für Autohaus Mustermann?",
    emailThread: sampleThread,
  };
  const replyUrl = buildReplyUrl(baseUrl, composeParams);
  const dashboardUrl = `${baseUrl}/admin/clients/test-client-id?lead=test-lead-id`;

  const templateProps = {
    recipientName: "Tilman",
    leadEmail: composeParams.leadEmail,
    leadName: composeParams.leadName,
    leadPhone: "+49 911 123 4567",
    companyName: "Autohaus Mustermann GmbH",
    campaignName: "Autohaus, Nürnberg (200km Radius)",
    clientName: "Demo Client",
    replySnippet: undefined,
    emailThread: sampleThread,
    dashboardUrl,
    replyUrl,
  };

  console.log("Rendering email template...\n");

  const emailHtml = await render(PositiveReplyNotification(templateProps));

  const outputPath = "/tmp/positive-reply-preview.html";
  writeFileSync(outputPath, emailHtml);
  console.log(`HTML saved to: ${outputPath}`);

  try {
    execSync(`open ${outputPath}`);
    console.log("Opened in browser!");
  } catch {
    console.log(`Open ${outputPath} in your browser to preview.`);
  }

  console.log("\nClick 'Reply to Lead' to test the smart redirect page.");
  console.log("First time: you'll pick Gmail or Outlook.");
  console.log("Next time: it auto-redirects to your saved choice.");
}

main();
