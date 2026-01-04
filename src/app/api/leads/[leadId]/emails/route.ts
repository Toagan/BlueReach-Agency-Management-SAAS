import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";

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

// POST - Sync emails from Instantly for a lead (using per-campaign API key)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const supabase = getSupabase();

    // Get lead info with campaign's provider_campaign_id
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, email, campaign_id, campaigns(id, provider_campaign_id, instantly_campaign_id, api_key_encrypted)")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Get campaign info from the joined data
    const campaignData = lead.campaigns as unknown as {
      id: string;
      provider_campaign_id: string | null;
      instantly_campaign_id: string | null;
      api_key_encrypted: string | null;
    } | null;

    if (!campaignData?.api_key_encrypted) {
      return NextResponse.json(
        { error: "Campaign has no API key configured" },
        { status: 400 }
      );
    }

    const providerCampaignId = campaignData.provider_campaign_id || campaignData.instantly_campaign_id;
    if (!providerCampaignId) {
      return NextResponse.json(
        { error: "Campaign has no provider campaign ID" },
        { status: 400 }
      );
    }

    console.log(`[Email Sync] Lead: ${lead.email}, Campaign: ${campaignData.id}`);

    // Get provider with per-campaign API key
    const provider = await getProviderForCampaign(campaignData.id);

    // Fetch emails from provider
    const providerEmails = await provider.fetchEmailsForLead(providerCampaignId, lead.email);

    let imported = 0;
    let skipped = 0;

    for (const email of providerEmails) {
      // Upsert email by provider_email_id
      const { error: upsertError } = await supabase
        .from("lead_emails")
        .upsert({
          lead_id: leadId,
          campaign_id: lead.campaign_id,
          provider_email_id: email.id,
          provider_thread_id: email.threadId || null,
          direction: email.isReply ? "inbound" : "outbound",
          from_email: email.fromEmail || "",
          to_email: email.toEmail || lead.email,
          subject: email.subject || null,
          body_text: email.bodyText || null,
          body_html: email.bodyHtml || null,
          sequence_step: null,
          is_auto_reply: false,
          sent_at: email.sentAt || null,
        }, {
          onConflict: "provider_email_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        if (upsertError.code === "23505") {
          skipped++;
        } else {
          console.error("Failed to upsert email:", upsertError);
        }
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: providerEmails.length,
    });
  } catch (error) {
    console.error("Error in POST /api/leads/[leadId]/emails:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync emails" },
      { status: 500 }
    );
  }
}
