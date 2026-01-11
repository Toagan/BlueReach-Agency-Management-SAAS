import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendPositiveReplyNotification } from "@/lib/email";
import { fetchEmailsForLead } from "@/lib/instantly/emails";
import { syncLeadToHubSpot, getEmailThreadForLead } from "@/lib/hubspot";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// Instantly webhook event types (from Instantly API V2 docs)
interface InstantlyWebhookPayload {
  // Base Fields (Always Present)
  timestamp: string;
  event_type: string;
  workspace: string;
  campaign_id: string;
  campaign_name: string;

  // Optional Fields
  lead_email?: string;
  email_account?: string;
  unibox_url?: string;

  // Step Information
  step?: number;
  variant?: number;
  is_first?: boolean;

  // Email information
  email_id?: string;
  email_subject?: string;
  email_text?: string;
  email_html?: string;

  // Reply Information
  reply_text_snippet?: string;
  reply_subject?: string;
  reply_text?: string;
  reply_html?: string;

  // Additional lead data fields
  [key: string]: unknown;
}

// Verify webhook signature if secret is configured
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | null
): boolean {
  if (!secret || !signature) {
    // If no secret configured, allow all webhooks (for development)
    return true;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// POST - Receive webhook events from Instantly
export async function POST(request: Request, { params }: RouteParams) {
  const startTime = Date.now();
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const payload: InstantlyWebhookPayload = JSON.parse(rawBody);

    // Verify signature if configured
    const signature = request.headers.get("x-instantly-signature");
    const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;

    if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error("[Webhook] Invalid signature for campaign:", campaignId);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Get the campaign to verify it exists
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("[Webhook] Campaign not found:", campaignId);
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Log the webhook event
    console.log(`[Webhook] Received event for campaign ${campaign.name}:`, {
      event_type: payload.event_type,
      email: payload.email || payload.lead_email,
      interest_status: payload.interest_status || payload.lt_interest_status,
    });

    // Store webhook payload in webhook_logs table
    const { error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        campaign_id: campaignId,
        event_type: payload.event_type || "unknown",
        lead_email: payload.lead_email?.toLowerCase().trim() || null,
        payload: payload,
      });

    if (logError) {
      // Don't fail the webhook if logging fails, just warn
      console.warn("[Webhook] Failed to log webhook payload:", logError.message);
    }

    // Get lead email from payload and normalize it
    const rawLeadEmail = payload.lead_email;

    if (!rawLeadEmail) {
      console.warn("[Webhook] No lead_email in payload:", payload);
      return NextResponse.json({
        success: true,
        message: "No lead_email in payload, skipped"
      });
    }

    // Normalize email to handle case sensitivity and whitespace
    const leadEmail = rawLeadEmail.toLowerCase().trim();

    // Instantly event types (from API V2 docs):
    // Positive: "lead_interested", "lead_meeting_booked", "lead_meeting_completed", "lead_closed"
    // Negative: "lead_not_interested", "lead_out_of_office", "lead_wrong_person"
    // Neutral: "lead_neutral"
    // Other: "email_sent", "email_opened", "reply_received", "auto_reply_received", "link_clicked", "email_bounced", "lead_unsubscribed"

    const eventType = payload.event_type || "";

    // Positive event types
    const positiveEvents = [
      "lead_interested",
      "lead_meeting_booked",
      "lead_meeting_completed",
      "lead_closed",
    ];

    // Negative event types
    const negativeEvents = [
      "lead_not_interested",
      "lead_out_of_office",
      "lead_wrong_person",
      "lead_neutral",
    ];

    const isPositive = positiveEvents.includes(eventType);
    const isNegative = negativeEvents.includes(eventType);
    const isReply = eventType === "reply_received" || eventType === "auto_reply_received";
    const isEmailSent = eventType === "email_sent";
    const isBounced = eventType === "email_bounced";

    // Get client_id from campaign for creating new leads
    const { data: campaignWithClient } = await supabase
      .from("campaigns")
      .select("client_id")
      .eq("id", campaignId)
      .single();

    const clientId = campaignWithClient?.client_id;

    // Get client name separately if we have client_id
    let clientName = "";
    if (clientId) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();
      clientName = clientData?.name || "";
    }

    // Try to find existing lead first
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, email_open_count, email_click_count, status")
      .eq("campaign_id", campaignId)
      .eq("email", leadEmail)
      .maybeSingle();

    // Build update data based on event type
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Handle different event types
    if (isPositive) {
      updateData.is_positive_reply = true;
      updateData.has_replied = true;
      updateData.status = "replied";
    } else if (isNegative) {
      updateData.is_positive_reply = false;
    }

    if (isReply) {
      updateData.has_replied = true;
      updateData.status = "replied";
      // Increment campaign's cached_reply_count
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("cached_reply_count")
        .eq("id", campaignId)
        .single();
      await supabase
        .from("campaigns")
        .update({ cached_reply_count: (campaignData?.cached_reply_count || 0) + 1 })
        .eq("id", campaignId);
    }

    if (isEmailSent) {
      // Mark lead as contacted
      if (!existingLead || existingLead.status === "new") {
        updateData.status = "contacted";
      }
      // Increment campaign's cached_emails_sent
      try {
        await supabase.rpc("increment_campaign_emails_sent", { campaign_uuid: campaignId });
      } catch {
        // RPC might not exist, update directly
        const currentSent = (campaign as { cached_emails_sent?: number }).cached_emails_sent || 0;
        await supabase
          .from("campaigns")
          .update({ cached_emails_sent: currentSent + 1 })
          .eq("id", campaignId);
      }
    }

    if (isBounced) {
      updateData.status = "bounced";
      // Increment campaign's cached_emails_bounced
      const currentBounced = (campaign as { cached_emails_bounced?: number }).cached_emails_bounced || 0;
      await supabase
        .from("campaigns")
        .update({ cached_emails_bounced: currentBounced + 1 })
        .eq("id", campaignId);
    }


    // Update or create lead
    let leadDbId: string | null = null;

    if (existingLead) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", existingLead.id);

      if (updateError) {
        console.error("[Webhook] Error updating lead:", updateError);
      } else {
        console.log(`[Webhook] Updated lead ${leadEmail} - event: ${eventType}`);
        leadDbId = existingLead.id;
      }
    } else if (clientId && (isPositive || isReply || isEmailSent)) {
      // Create new lead if it doesn't exist and this is a meaningful event
      const { data: insertedLead, error: insertError } = await supabase
        .from("leads")
        .insert({
          email: leadEmail,
          campaign_id: campaignId,
          client_id: clientId,
          client_name: clientName,
          campaign_name: campaign.name,
          is_positive_reply: isPositive,
          has_replied: isReply || isPositive,
          status: isPositive || isReply ? "replied" : "contacted",
          ...updateData,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[Webhook] Error creating lead:", insertError);
      } else {
        console.log(`[Webhook] Created new lead ${leadEmail} from webhook event: ${eventType}`);
        leadDbId = insertedLead?.id || null;
      }
    } else {
      console.warn(`[Webhook] Lead not found and not creating for event ${eventType}: ${leadEmail}`);
    }

    // Save email content to lead_emails table for reply_received and email_sent events
    if (leadDbId && (isReply || isEmailSent)) {
      const emailId = payload.email_id || `webhook-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const emailAccount = payload.email_account || "";

      // Determine content based on event type
      let subject: string | null = null;
      let bodyText: string | null = null;
      let bodyHtml: string | null = null;
      let direction: "outbound" | "inbound" = "outbound";
      let fromEmail = emailAccount;
      let toEmail = leadEmail;

      if (isReply) {
        // Inbound reply from lead
        direction = "inbound";
        subject = payload.reply_subject || payload.email_subject || null;
        bodyText = payload.reply_text || payload.email_text || null;
        bodyHtml = payload.reply_html || payload.email_html || null;
        fromEmail = leadEmail;
        toEmail = emailAccount;
      } else if (isEmailSent) {
        // Outbound email to lead
        direction = "outbound";
        subject = payload.email_subject || null;
        bodyText = payload.email_text || null;
        bodyHtml = payload.email_html || null;
      }

      // Only save if we have some content
      if (subject || bodyText || bodyHtml) {
        const emailRecord = {
          lead_id: leadDbId,
          campaign_id: campaignId,
          provider_email_id: emailId,
          direction,
          from_email: fromEmail,
          to_email: toEmail,
          subject,
          body_text: bodyText,
          body_html: bodyHtml,
          sequence_step: payload.step || null,
          is_auto_reply: eventType === "auto_reply_received",
          sent_at: payload.timestamp || new Date().toISOString(),
        };

        const { error: emailError } = await supabase
          .from("lead_emails")
          .upsert(emailRecord, {
            onConflict: "provider_email_id",
            ignoreDuplicates: false,
          });

        if (emailError) {
          console.error("[Webhook] Error saving email:", emailError);
        } else {
          console.log(`[Webhook] Saved ${direction} email for ${leadEmail}`);
        }
      }
    }

    // Auto-fetch full email thread from Instantly for reply events
    // This ensures we have the complete conversation history stored locally
    if (leadDbId && isReply && campaign.instantly_campaign_id) {
      try {
        console.log(`[Webhook] Fetching full email thread for ${leadEmail}`);
        const emails = await fetchEmailsForLead(leadEmail, campaign.instantly_campaign_id);

        if (emails.length > 0) {
          let savedCount = 0;
          for (const email of emails) {
            const providerEmailId = email.id || `instantly-${email.timestamp_email || Date.now()}-${Math.random().toString(36).substring(7)}`;

            const emailRecord = {
              lead_id: leadDbId,
              campaign_id: campaignId,
              provider_email_id: providerEmailId,
              direction: email.from_address_email?.toLowerCase() === leadEmail ? "inbound" as const : "outbound" as const,
              from_email: email.from_address_email || "",
              to_email: email.to_address_email_list?.[0] || "",
              subject: email.subject || null,
              body_text: email.body?.text || null,
              body_html: email.body?.html || null,
              sent_at: email.timestamp_email || email.timestamp_created || new Date().toISOString(),
            };

            const { error: saveError } = await supabase
              .from("lead_emails")
              .upsert(emailRecord, {
                onConflict: "provider_email_id",
                ignoreDuplicates: true,
              });

            if (!saveError) savedCount++;
          }
          console.log(`[Webhook] Saved ${savedCount}/${emails.length} emails from full thread for ${leadEmail}`);
        }
      } catch (fetchError) {
        // Don't fail the webhook if email fetch fails
        console.error("[Webhook] Error fetching email thread:", fetchError);
      }
    }

    // Send email notification for positive replies
    if (isPositive && clientId) {
      try {
        // Get lead details for the notification
        const { data: leadDetails } = await supabase
          .from("leads")
          .select("first_name, last_name, company_name, phone")
          .eq("campaign_id", campaignId)
          .eq("email", leadEmail)
          .maybeSingle();

        const leadName = leadDetails
          ? [leadDetails.first_name, leadDetails.last_name].filter(Boolean).join(" ") || undefined
          : undefined;

        // Get reply snippet from payload
        const replySnippet = payload.reply_text_snippet ||
          (payload.reply_text ? payload.reply_text.substring(0, 150) + (payload.reply_text.length > 150 ? "..." : "") : undefined);

        console.log(`[Webhook] Sending positive reply notification for ${leadEmail}`);

        const notificationResult = await sendPositiveReplyNotification({
          leadEmail,
          leadName,
          companyName: leadDetails?.company_name || undefined,
          campaignName: campaign.name,
          clientId,
          clientName,
          replySnippet,
        });

        if (notificationResult.success) {
          console.log(`[Webhook] Notification sent to: ${notificationResult.sentTo.join(", ")}`);
        } else {
          console.error(`[Webhook] Failed to send notification: ${notificationResult.error}`);
        }
      } catch (notifyError) {
        // Don't fail the webhook if notification fails
        console.error("[Webhook] Error sending notification:", notifyError);
      }

      // Sync positive reply to HubSpot CRM
      if (leadDbId) {
        try {
          // Get email thread for the lead
          const emailThread = await getEmailThreadForLead(leadDbId);

          // Get lead details for HubSpot
          const { data: leadDetails } = await supabase
            .from("leads")
            .select("first_name, last_name, company_name, phone")
            .eq("id", leadDbId)
            .single();

          console.log(`[Webhook] Syncing positive reply to HubSpot for ${leadEmail}`);

          const hubspotResult = await syncLeadToHubSpot({
            leadEmail,
            leadFirstName: leadDetails?.first_name || undefined,
            leadLastName: leadDetails?.last_name || undefined,
            leadPhone: leadDetails?.phone || undefined,
            companyName: leadDetails?.company_name || undefined,
            campaignName: campaign.name,
            clientId,
            clientName,
            emailThread,
          });

          if (hubspotResult.success) {
            if (hubspotResult.skipped) {
              console.log(`[Webhook] HubSpot sync skipped (not enabled for client)`);
            } else {
              console.log(`[Webhook] HubSpot sync complete - Contact: ${hubspotResult.contactId}, Note: ${hubspotResult.noteId}`);
            }
          } else {
            console.error(`[Webhook] HubSpot sync failed: ${hubspotResult.error}`);
          }
        } catch (hubspotError) {
          // Don't fail the webhook if HubSpot sync fails
          console.error("[Webhook] Error syncing to HubSpot:", hubspotError);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Processed in ${duration}ms`);

    // Update webhook log with processing result
    if (payload.lead_email) {
      await supabase
        .from("webhook_logs")
        .update({
          processing_duration_ms: duration,
          success: true,
        })
        .eq("campaign_id", campaignId)
        .eq("lead_email", payload.lead_email.toLowerCase().trim())
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return NextResponse.json({
      success: true,
      campaign: campaign.name,
      event_type: payload.event_type,
      lead_email: leadEmail,
      is_positive: isPositive,
      processed_at: new Date().toISOString(),
    });

  } catch (error) {
    // Log error but return 200 to prevent Instantly from retrying
    // Webhooks should acknowledge receipt even on processing failures
    console.error("[Webhook] Error processing webhook:", error);

    // Try to update webhook log with error
    try {
      const duration = Date.now() - startTime;
      await supabase
        .from("webhook_logs")
        .update({
          processing_duration_ms: duration,
          success: false,
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1);
    } catch {
      // Ignore log update errors
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process webhook",
      acknowledged: true,
    });
  }
}

// GET - Return webhook info/status for this campaign
export async function GET(request: Request, { params }: RouteParams) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get the base URL from the request
    const url = new URL(request.url);
    const webhookUrl = `${url.protocol}//${url.host}/api/webhooks/instantly/${campaignId}`;

    return NextResponse.json({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      instantly_campaign_id: campaign.instantly_campaign_id,
      webhook_url: webhookUrl,
      supported_events: {
        positive: ["lead_interested", "lead_meeting_booked", "lead_meeting_completed", "lead_closed"],
        negative: ["lead_not_interested", "lead_out_of_office", "lead_wrong_person", "lead_neutral"],
        other: ["reply_received", "email_sent", "email_opened", "link_clicked", "email_bounced"],
      },
      instructions: "Configure this URL in your Instantly campaign webhook settings. Select the events you want to track. Positive events (lead_interested, lead_meeting_booked, etc.) will set is_positive_reply=true.",
    });

  } catch (error) {
    console.error("[Webhook] Error fetching campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
