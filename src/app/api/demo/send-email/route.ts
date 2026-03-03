// Demo email trigger endpoint - sends sample email notifications for demo clients
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPositiveReplyNotification, sendStatsReport, buildReplyBody, getReplySubject } from "@/lib/email/send";
import { requireAdmin } from "@/lib/auth";

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
    emailThread: [
      {
        direction: "outbound" as const,
        from_email: "tilman@blue-reach.com",
        to_email: "max.mustermann@autohaus-example.de",
        subject: "Mehr Neukunden für Autohaus Mustermann?",
        body_text: "Hallo Herr Mustermann,\n\nich bin Tilman von Blue Reach. Wir helfen Autohäusern dabei, gezielt neue Kunden in Ihrer Region zu gewinnen — ohne Streuverlust.\n\nAktuell arbeiten wir mit mehreren Autohäusern im Raum Nürnberg zusammen und generieren dort durchschnittlich 15-20 qualifizierte Anfragen pro Monat.\n\nHätten Sie Interesse an einem kurzen Austausch dazu?\n\nBeste Grüße,\nTilman Schepke\nBlue Reach",
        body_html: null,
        sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        direction: "inbound" as const,
        from_email: "max.mustermann@autohaus-example.de",
        to_email: "tilman@blue-reach.com",
        subject: "Re: Mehr Neukunden für Autohaus Mustermann?",
        body_text: "Hallo Herr Schepke,\n\nvielen Dank für Ihre Nachricht! Das klingt sehr interessant. Wir haben tatsächlich gerade Bedarf an neuen Kunden, besonders im Bereich Gebrauchtwagen.\n\nKönnten wir diese Woche einen kurzen Termin vereinbaren? Ich bin Dienstag und Donnerstag nachmittags verfügbar.\n\nMit freundlichen Grüßen,\nMax Mustermann\nAutohaus Mustermann GmbH\n+49 911 123 4567",
        body_html: null,
        sent_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    email: "sarah.schmidt@logistik-partner.de",
    name: "Sarah Schmidt",
    phone: "+49 89 987 6543",
    company: "Logistik Partner AG",
    campaign: "Logistics Companies, Bavaria",
    replySnippet: "Interessantes Angebot! Wir suchen gerade nach Lösungen in diesem Bereich. Könnten Sie mir mehr Details schicken?",
    emailThread: [
      {
        direction: "outbound" as const,
        from_email: "tilman@blue-reach.com",
        to_email: "sarah.schmidt@logistik-partner.de",
        subject: "Logistik Partner AG - Effizienzsteigerung durch gezielte Leadgenerierung",
        body_text: "Hallo Frau Schmidt,\n\nich bin Tilman von Blue Reach. Wir unterstützen Logistikunternehmen bei der Neukundengewinnung im B2B-Bereich.\n\nMit unserem datengetriebenen Ansatz erreichen wir für unsere Kunden eine Antwortrate von 8-12%, deutlich über dem Branchendurchschnitt.\n\nWäre ein kurzer Austausch für Sie interessant?\n\nBeste Grüße,\nTilman",
        body_html: null,
        sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        direction: "inbound" as const,
        from_email: "sarah.schmidt@logistik-partner.de",
        to_email: "tilman@blue-reach.com",
        subject: "Re: Logistik Partner AG - Effizienzsteigerung durch gezielte Leadgenerierung",
        body_text: "Hallo Tilman,\n\ninteressantes Angebot! Wir suchen gerade nach Lösungen in diesem Bereich und haben intern bereits über das Thema Outbound gesprochen.\n\nKönnten Sie mir mehr Details schicken? Insbesondere interessiert mich:\n- Wie genau sieht der Prozess aus?\n- Welche Ergebnisse erzielen Sie in der Logistikbranche?\n- Was sind die Kosten?\n\nViele Grüße,\nSarah Schmidt\nLogistik Partner AG",
        body_html: null,
        sent_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ],
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
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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
        emailThread: sampleLead.emailThread,
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

        const composeParams = {
          leadEmail: params.leadEmail,
          leadName: params.leadName,
          originalSubject: params.emailThread?.[0]?.subject || undefined,
          emailThread: params.emailThread,
        };

        // Create reply token
        const subject = getReplySubject(composeParams);
        const body = buildReplyBody(composeParams);
        const { data: token } = await supabase
          .from("reply_tokens")
          .insert({
            lead_email: params.leadEmail,
            subject,
            body,
            lead_id: null,
          })
          .select("id")
          .single();

        const replyUrl = token
          ? `${baseUrl}/reply?token=${token.id}`
          : undefined;

        const templateProps = {
          recipientName: recipientEmail.split("@")[0],
          leadEmail: params.leadEmail,
          leadName: params.leadName,
          leadPhone: params.leadPhone,
          companyName: params.companyName,
          campaignName: params.campaignName,
          clientName: params.clientName,
          replySnippet: params.replySnippet,
          emailThread: params.emailThread,
          dashboardUrl,
          replyUrl,
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
