// Demo email trigger endpoint - sends sample email notifications for demo clients
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPositiveReplyNotification, sendStatsReport } from "@/lib/email/send";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Sample data for demo emails
const SAMPLE_LEADS = [
  {
    email: "max.mustermann@autohaus-example.de",
    name: "Max Mustermann",
    phone: "+49 911 123 4567",
    company: "Autohaus Mustermann GmbH",
    campaign: "Autohaus, Nürnberg (200km Radius)",
    replySnippet: "Vielen Dank für Ihre Nachricht! Wir haben Interesse an Ihrem Angebot und würden gerne mehr erfahren. Können wir einen Termin für ein Gespräch vereinbaren?",
  },
  {
    email: "sarah.schmidt@logistik-partner.de",
    name: "Sarah Schmidt",
    phone: "+49 89 987 6543",
    company: "Logistik Partner AG",
    campaign: "Logistics Companies, Bavaria",
    replySnippet: "Interessantes Angebot! Wir suchen gerade nach Lösungen in diesem Bereich. Könnten Sie mir mehr Details schicken?",
  },
  {
    email: "thomas.weber@tech-solutions.de",
    name: "Thomas Weber",
    phone: "+49 30 555 1234",
    company: "Tech Solutions GmbH",
    campaign: "IT Companies, Berlin",
    replySnippet: "Hi, thanks for reaching out. This looks like it could be exactly what we need. Let's schedule a call this week?",
  },
  {
    email: "julia.meyer@finance-corp.de",
    name: "Julia Meyer",
    phone: "+49 69 444 7890",
    company: "Finance Corp",
    campaign: "Financial Services, Frankfurt",
    replySnippet: "We've been looking for a solution like this. When would be a good time for a quick demo?",
  },
];

const SAMPLE_STATS = {
  emailsSent: 1247,
  replies: 89,
  positiveReplies: 34,
  replyRate: 7.1,
};

const SAMPLE_PREVIOUS_STATS = {
  emailsSent: 1180,
  replies: 72,
  positiveReplies: 28,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      emailType,
      recipientEmail, // Optional: override recipient
    } = body;

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    if (!emailType || !["positive_reply", "stats_report"].includes(emailType)) {
      return NextResponse.json(
        { error: "emailType must be 'positive_reply' or 'stats_report'" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, is_demo")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Optional: Restrict to demo clients only
    // if (!client.is_demo) {
    //   return NextResponse.json(
    //     { error: "This endpoint is only for demo clients" },
    //     { status: 403 }
    //   );
    // }

    let result;

    if (emailType === "positive_reply") {
      // Pick a random sample lead
      const sampleLead = SAMPLE_LEADS[Math.floor(Math.random() * SAMPLE_LEADS.length)];

      const params = {
        leadEmail: sampleLead.email,
        leadName: sampleLead.name,
        leadPhone: sampleLead.phone,
        companyName: sampleLead.company,
        campaignName: sampleLead.campaign,
        clientId: client.id,
        clientName: client.name,
        replySnippet: sampleLead.replySnippet,
      };

      // If recipient email is provided, use custom sending logic
      if (recipientEmail) {
        // Import and use direct Resend for custom recipient
        const { Resend } = await import("resend");
        const { PositiveReplyNotification, generatePlainText } = await import(
          "@/lib/email/templates/PositiveReplyNotification"
        );
        const { getBrandingSettings } = await import("@/lib/email/send");
        const { render } = await import("@react-email/render");

        // Get Resend API key from settings or env
        const { data: setting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "resend_api_key")
          .single();

        const apiKey = setting?.value || process.env.RESEND_API_KEY;
        if (!apiKey) {
          return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
        }

        const resend = new Resend(apiKey);
        const branding = await getBrandingSettings();

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
        const dashboardUrl = `${baseUrl}/admin/clients/${client.id}`;

        const templateProps = {
          recipientName: recipientEmail.split("@")[0],
          leadEmail: params.leadEmail,
          leadName: params.leadName,
          leadPhone: params.leadPhone,
          companyName: params.companyName,
          campaignName: params.campaignName,
          clientName: params.clientName,
          replySnippet: params.replySnippet,
          dashboardUrl,
        };

        const emailHtml = await render(PositiveReplyNotification(templateProps));
        const emailText = generatePlainText(templateProps);

        const { data, error } = await resend.emails.send({
          from: `${branding.senderName} <${branding.senderEmail}>`,
          to: recipientEmail,
          subject: `🎯 New Positive Reply: ${params.leadName} - ${params.clientName}`,
          html: emailHtml,
          text: emailText,
        });

        if (error) {
          result = { success: false, error: error.message, sentTo: [] };
        } else {
          result = { success: true, sentTo: [recipientEmail], emailId: data?.id };
        }
      } else {
        // Use standard notification function (sends to configured recipients)
        result = await sendPositiveReplyNotification(params);
      }
    } else {
      // stats_report
      // Calculate date range for this week
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const periodRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      const params = {
        clientId: client.id,
        clientName: client.name,
        periodLabel: "Weekly",
        periodRange,
        stats: SAMPLE_STATS,
        previousStats: SAMPLE_PREVIOUS_STATS,
      };

      if (recipientEmail) {
        // Send to custom recipient
        result = await sendStatsReport({
          ...params,
          customRecipients: [{ email: recipientEmail, name: recipientEmail.split("@")[0] }],
        });
      } else {
        // Use standard notification function
        result = await sendStatsReport(params);
      }
    }

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Demo ${emailType} email sent successfully`
        : `Failed to send demo email: ${result.error}`,
      sentTo: result.sentTo,
      error: result.error,
    });
  } catch (error) {
    console.error("[Demo Email] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send demo email" },
      { status: 500 }
    );
  }
}
