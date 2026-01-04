/**
 * Test email sending with the new React Email template
 *
 * Usage: npx tsx scripts/test-email.ts <email>
 * Example: npx tsx scripts/test-email.ts tilschego@gmail.com
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { sendInvitationEmail } from "../src/lib/email";

async function testEmail() {
  const toEmail = process.argv[2];

  if (!toEmail) {
    console.error("Usage: npx tsx scripts/test-email.ts <email>");
    console.error("Example: npx tsx scripts/test-email.ts tilschego@gmail.com");
    process.exit(1);
  }

  console.log(`\nSending enterprise-grade invitation email to: ${toEmail}\n`);
  console.log("Template features:");
  console.log("  - Branded header with agency logo/name");
  console.log("  - Professional copy with inviter name");
  console.log("  - Indigo CTA button");
  console.log("  - Security note with recipient email");
  console.log("  - Plain text fallback");
  console.log("  - '[Name] | BlueReach' sender format");
  console.log("");

  const result = await sendInvitationEmail({
    to: toEmail,
    inviteeName: "Tilman",
    inviterName: "Tilman Schepke",
    clientName: "Almaron GmbH",
    loginUrl: "https://app.blue-reach.com/login?invite=test-token-123",
  });

  if (result.success) {
    console.log("\nSUCCESS!");
    console.log("Email ID:", result.emailId);
    console.log(`\nCheck ${toEmail} inbox for the professional invitation email.`);
  } else {
    console.error("\nERROR:", result.error);
    process.exit(1);
  }
}

testEmail();
