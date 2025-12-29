import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchEmailsForLead } from "@/lib/instantly/emails";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ leadId: string }>;
}

// GET: Fetch emails for a lead (from DB)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { leadId } = await params;
    const supabase = getSupabase();

    // First check if table exists and has data
    const { data: emails, error: dbError } = await supabase
      .from("lead_emails")
      .select("*")
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: true });

    if (dbError) {
      // If table doesn't exist yet, return empty array with needsSync flag
      if (dbError.code === "42P01") {
        return NextResponse.json({ emails: [], needsSync: true });
      }
      console.error("DB error fetching emails:", dbError);
      throw dbError;
    }

    // Get lead to check last sync
    const { data: lead } = await supabase
      .from("leads")
      .select("email, campaign_id")
      .eq("id", leadId)
      .single();

    return NextResponse.json({
      emails: emails || [],
      leadEmail: lead?.email,
      needsSync: !emails || emails.length === 0,
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

// POST: Sync emails from Instantly for this lead
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { leadId } = await params;
    const supabase = getSupabase();

    // Get lead email address
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("email, campaign_id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Fetch emails from Instantly
    const instantlyEmails = await fetchEmailsForLead(lead.email);

    if (!instantlyEmails || instantlyEmails.length === 0) {
      return NextResponse.json({
        message: "No emails found in Instantly",
        synced: 0,
      });
    }

    // Upsert emails into database
    const emailsToUpsert = instantlyEmails.map((email) => ({
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      provider_email_id: email.id,
      provider_thread_id: email.thread_id || null,
      direction: email.is_reply ? "inbound" as const : "outbound" as const,
      from_email: email.from_address_email,
      to_email: email.to_address_email_list?.[0] || lead.email,
      cc_emails: email.cc_address_email_list || null,
      bcc_emails: email.bcc_address_email_list || null,
      subject: email.subject || null,
      body_text: email.body?.text || null,
      body_html: email.body?.html || null,
      sent_at: email.timestamp_email || email.timestamp_created || new Date().toISOString(),
      is_auto_reply: false,
    }));

    const { error: upsertError } = await supabase
      .from("lead_emails")
      .upsert(emailsToUpsert, {
        onConflict: "provider_email_id",
      });

    if (upsertError) {
      console.error("Error upserting emails:", upsertError);
      throw upsertError;
    }

    return NextResponse.json({
      message: "Emails synced successfully",
      synced: emailsToUpsert.length,
    });
  } catch (error) {
    console.error("Error syncing emails:", error);
    return NextResponse.json(
      { error: "Failed to sync emails from Instantly" },
      { status: 500 }
    );
  }
}
