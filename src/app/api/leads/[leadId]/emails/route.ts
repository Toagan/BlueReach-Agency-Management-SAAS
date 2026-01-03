import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchEmailsForLead, getInstantlyClient } from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch emails from database for a lead
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const supabase = getSupabase();

    // Get lead to find the email
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, email, campaign_id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch emails from database
    const { data: emails, error: emailsError } = await supabase
      .from("lead_emails")
      .select("*")
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: true });

    if (emailsError) {
      console.error("Error fetching emails:", emailsError);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    return NextResponse.json({ emails: emails || [] });
  } catch (error) {
    console.error("Error in GET /api/leads/[leadId]/emails:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

// POST - Sync emails from Instantly for a lead
export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const supabase = getSupabase();

    // Check if Instantly is configured
    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    // Get lead info with campaign's Instantly ID
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, email, campaign_id, campaigns(instantly_campaign_id)")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Get the Instantly campaign ID from the joined data
    const instantlyCampaignId = (lead.campaigns as { instantly_campaign_id: string | null } | null)?.instantly_campaign_id;

    console.log(`[Email Sync] Lead: ${lead.email}, Instantly Campaign: ${instantlyCampaignId}`);

    // Fetch emails from Instantly - pass campaign ID for more accurate results
    const instantlyEmails = await fetchEmailsForLead(lead.email, instantlyCampaignId || undefined);

    let imported = 0;
    let skipped = 0;

    for (const email of instantlyEmails) {
      // Check if email already exists
      const { data: existing } = await supabase
        .from("lead_emails")
        .select("id")
        .eq("lead_id", leadId)
        .eq("provider_email_id", email.id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Determine direction based on from/to emails
      const isOutbound = email.from_address_email !== lead.email;
      const toEmail = email.to_address_email_list?.[0] || lead.email;

      // Insert email
      const { error: insertError } = await supabase.from("lead_emails").insert({
        lead_id: leadId,
        campaign_id: lead.campaign_id,
        provider_email_id: email.id,
        provider_thread_id: email.thread_id || null,
        direction: isOutbound ? "outbound" : "inbound",
        from_email: email.from_address_email || "",
        to_email: toEmail,
        subject: email.subject || null,
        body_text: email.body?.text || null,
        body_html: email.body?.html || email.body?.text || null,
        sequence_step: null,
        is_auto_reply: false,
        sent_at: email.timestamp_email || email.timestamp_created || null,
        metadata: {
          instantly_data: {
            campaign_id: email.i_campaign,
            eaccount: email.eaccount,
            is_reply: email.is_reply,
          },
        },
      });

      if (insertError) {
        console.error("Failed to insert email:", insertError);
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: instantlyEmails.length,
    });
  } catch (error) {
    console.error("Error in POST /api/leads/[leadId]/emails:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync emails" },
      { status: 500 }
    );
  }
}
