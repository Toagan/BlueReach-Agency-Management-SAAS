// Historical Email Sync Endpoint
// Fetches all email threads for leads in a campaign from Instantly API
// and stores them in the lead_emails table

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, client_id, name, provider_type, provider_campaign_id, instantly_campaign_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;
    if (!providerCampaignId) {
      return NextResponse.json(
        { error: "Campaign not linked to provider" },
        { status: 400 }
      );
    }

    // Get provider instance
    const provider = await getProviderForCampaign(campaignId);

    console.log(`[SyncEmails] Starting email sync for campaign ${campaignId}`);

    // Get all leads for this campaign that have replied or are positive
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, email, provider_lead_id, instantly_lead_id")
      .eq("campaign_id", campaignId)
      .or("has_replied.eq.true,is_positive_reply.eq.true,email_reply_count.gt.0");

    if (leadsError) {
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads with replies found",
        synced: 0,
      });
    }

    console.log(`[SyncEmails] Found ${leads.length} leads with replies to sync`);

    let totalEmailsSynced = 0;
    let leadsProcessed = 0;
    const errors: string[] = [];

    // Check if provider supports email fetching
    if (!('fetchEmailsForLead' in provider) || typeof provider.fetchEmailsForLead !== 'function') {
      return NextResponse.json(
        { error: "Provider does not support email fetching" },
        { status: 400 }
      );
    }

    // Process leads in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (lead) => {
          try {
            // Fetch emails for this lead from provider
            const emails = await provider.fetchEmailsForLead(providerCampaignId, lead.email);

            if (!emails || emails.length === 0) {
              return;
            }

            // Get existing email IDs to avoid duplicates
            const { data: existingEmails } = await supabase
              .from("lead_emails")
              .select("provider_email_id")
              .eq("lead_id", lead.id);

            const existingIds = new Set(
              (existingEmails || []).map((e) => e.provider_email_id).filter(Boolean)
            );

            // Insert new emails
            const newEmails = emails.filter(
              (email) => !email.id || !existingIds.has(email.id)
            );

            if (newEmails.length === 0) {
              return;
            }

            const emailRecords = newEmails.map((email) => ({
              lead_id: lead.id,
              campaign_id: campaignId,
              provider_email_id: email.id,
              provider_thread_id: email.threadId,
              direction: email.isReply ? "inbound" : "outbound",
              from_email: email.fromEmail,
              to_email: email.toEmail || lead.email,
              subject: email.subject,
              body_text: email.bodyText,
              body_html: email.bodyHtml,
              sent_at: email.sentAt,
              created_at: new Date().toISOString(),
            }));

            const { error: insertError } = await supabase
              .from("lead_emails")
              .insert(emailRecords);

            if (insertError) {
              console.error(`[SyncEmails] Error inserting emails for ${lead.email}:`, insertError);
              errors.push(`${lead.email}: ${insertError.message}`);
            } else {
              totalEmailsSynced += newEmails.length;
            }

            leadsProcessed++;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`[SyncEmails] Error syncing emails for ${lead.email}:`, err);
            errors.push(`${lead.email}: ${errorMsg}`);
          }
        })
      );

      // Small delay between batches to respect rate limits
      if (i + batchSize < leads.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update last sync timestamp
    await supabase
      .from("campaigns")
      .update({ last_email_sync_at: new Date().toISOString() })
      .eq("id", campaignId);

    console.log(`[SyncEmails] Completed: ${totalEmailsSynced} emails synced for ${leadsProcessed} leads`);

    return NextResponse.json({
      success: true,
      totalLeads: leads.length,
      leadsProcessed,
      emailsSynced: totalEmailsSynced,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit errors in response
    });
  } catch (error) {
    console.error("[SyncEmails] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync emails",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check email sync status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get campaign with last sync time
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("last_email_sync_at")
    .eq("id", campaignId)
    .single();

  // Count emails for this campaign
  const { count: emailCount } = await supabase
    .from("lead_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  // Count leads with emails
  const { data: leadsWithEmails } = await supabase
    .from("lead_emails")
    .select("lead_id")
    .eq("campaign_id", campaignId);

  const uniqueLeadsWithEmails = new Set(leadsWithEmails?.map((e) => e.lead_id) || []).size;

  return NextResponse.json({
    lastSyncAt: campaign?.last_email_sync_at,
    emailCount: emailCount || 0,
    leadsWithEmails: uniqueLeadsWithEmails,
  });
}
