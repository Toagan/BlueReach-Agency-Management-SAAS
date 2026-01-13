// Test endpoint for positive reply notification email
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { PositiveReplyNotification, generatePlainText } from "@/lib/email/templates/PositiveReplyNotification";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || "tilman@blue-reach.com";

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const resend = new Resend(resendKey);

  // Sample data for the test email
  const props = {
    recipientName: "Tilman",
    leadEmail: "max.mustermann@autohaus-example.de",
    leadName: "Max Mustermann",
    companyName: "Autohaus Mustermann GmbH",
    campaignName: "Autohaus, Nürnberg (200km Radius)",
    clientName: "Digital Bude",
    replySnippet: "Vielen Dank für Ihre Nachricht! Wir haben Interesse an Ihrem Angebot und würden gerne mehr erfahren. Können wir einen Termin für ein Gespräch vereinbaren?",
    dashboardUrl: "https://bluereach-agency-management-saas-production.up.railway.app/admin/clients/test",
  };

  try {
    const { data, error } = await resend.emails.send({
      from: "BlueReach <notifications@blue-reach.com>",
      to: [to],
      subject: `🎯 New Positive Reply: ${props.leadName} - ${props.clientName}`,
      react: PositiveReplyNotification(props),
      text: generatePlainText(props),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${to}`,
      emailId: data?.id
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to send"
    }, { status: 500 });
  }
}
