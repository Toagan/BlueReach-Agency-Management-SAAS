import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendPositiveReplyNotification } from "@/lib/email";
import { syncLeadToHubSpot, getEmailThreadForLead } from "@/lib/hubspot";
import type { SmartleadWebhookPayload } from "@/lib/smartlead";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// Verify webhook signature (HMAC SHA256)
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Map SmartLead event type to a normalized event name
function normalizeEventType(eventType: string): string {
  switch (eventType) {
    case "EMAIL_SENT":
      return "email_sent";
    case "EMAIL_OPEN":
    case "EMAIL_OPENED":
      return "email_opened";
    case "LINK_CLICKED":
    case "EMAIL_LINK_CLICK":
      return "link_clicked";
    case "EMAIL_REPLY":
    case "REPLY":
      return "reply_received";
    case "EMAIL_BOUNCED":
      return "email_bounced";
    case "LEAD_UNSUBSCRIBED":
      return "unsubscribed";
    case "LEAD_CATEGORY_CHANGE":
    case "LEAD_CATEGORY_UPDATED":
      return "lead_category_change";
    default:
      return "unknown";
  }
}

// Map SmartLead category to local status and is_positive_reply
function mapCategory(category: string | undefined): {
  status: string | null;
  isPositiveReply: boolean | null;
} {
  if (!category) return { status: null, isPositiveReply: null };

  switch (category.toUpperCase()) {
    case "INTERESTED":
      return { status: "replied", isPositiveReply: true };
    case "MEETING_BOOKED":
    case "MEETING BOOKED":
      return { status: "booked", isPositiveReply: true };
    case "MEETING_COMPLETED":
    case "MEETING COMPLETED":
      return { status: "booked", isPositiveReply: true };
    case "CLOSED":
      return { status: "won", isPositiveReply: true };
    case "NOT_INTERESTED":
    case "NOT INTERESTED":
      return { status: "not_interested", isPositiveReply: false };
    case "WRONG_PERSON":
    case "WRONG PERSON":
      return { status: "lost", isPositiveReply: false };
    case "DO_NOT_CONTACT":
    case "DO NOT CONTACT":
      return { status: "lost", isPositiveReply: false };
    case "NOT_NOW":
    case "NOT NOW":
      return { status: "replied", isPositiveReply: false };
    default:
      return { status: null, isPositiveReply: null };
  }
}

// Update daily analytics counters
async function updateDailyAnalytics(
  supabase: ReturnType<typeof getSupabase>,
  campaignId: string,
  normalizedEvent: string,
  timestamp: string
) {
  const eventDate = timestamp.split("T")[0] || new Date().toISOString().split("T")[0];

  const columnMap: Record<string, string> = {
    email_sent: "emails_sent",
    email_opened: "emails_opened",
    link_clicked: "emails_clicked",
    reply_received: "emails_replied",
    lead_category_change: "positive_replies",
    email_bounced: "emails_bounced",
  };

  const column = columnMap[normalizedEvent];
  if (!column) return;

  try {
    const { data: existing } = await supabase
      .from("campaign_analytics_daily")
      .select("id, " + column)
      .eq("campaign_id", campaignId)
      .eq("snapshot_date", eventDate)
      .single();

    if (existing) {
      const currentValue = (existing as unknown as Record<string, number>)[column] || 0;
      await supabase
        .from("campaign_analytics_daily")
        .update({
          [column]: currentValue + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existing as unknown as { id: string }).id);
    } else {
      await supabase.from("campaign_analytics_daily").insert({
        campaign_id: campaignId,
        snapshot_date: eventDate,
        [column]: 1,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[SmartLead Webhook] Error updating daily analytics:", err);
  }
}

// POST - Receive webhook events from SmartLead
export async function POST(request: Request, { params }: RouteParams) {
  const startTime = Date.now();
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const payload: SmartleadWebhookPayload = JSON.parse(rawBody);

    // Verify signature if configured
    const signature = request.headers.get("x-smartlead-signature");

    // Check for webhook secret in settings
    const { data: secretSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "smartlead_webhook_secret")
      .single();

    const webhookSecret = secretSetting?.value || null;

    if (!webhookSecret) {
      console.warn("[SmartLead Webhook] smartlead_webhook_secret not configured - signature verification disabled. Set this in production!");
    } else if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error("[SmartLead Webhook] Invalid signature for campaign:", campaignId);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Get the campaign to verify it exists
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, client_id, provider_campaign_id, hubspot_vertical")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("[SmartLead Webhook] Campaign not found:", campaignId);
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const eventType = payload.event_type || "";
    const normalizedEvent = normalizeEventType(eventType);

    // Log the webhook event
    console.log(`[SmartLead Webhook] Received event for campaign ${campaign.name}:`, {
      event_type: eventType,
      normalized: normalizedEvent,
      email: payload.email,
      category: payload.category,
    });

    // Normalize lead email
    const rawLeadEmail = payload.email;
    const leadEmail = rawLeadEmail?.toLowerCase().trim() || null;

    // Idempotency check: build a unique key for this event
    const idempotencyKey = `${eventType}:${leadEmail || "unknown"}:${payload.timestamp || Date.now()}`;

    // Check if we've already processed this exact event
    const { data: existingLog } = await supabase
      .from("webhook_logs")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingLog) {
      console.log(`[SmartLead Webhook] Duplicate event skipped: ${idempotencyKey}`);
      return NextResponse.json({
        success: true,
        message: "Duplicate event, already processed",
        deduplicated: true,
      });
    }

    // Store webhook payload in webhook_logs table with idempotency key
    const { error: logError } = await supabase
      .from("webhook_logs")
      .insert({
        campaign_id: campaignId,
        event_type: eventType,
        lead_email: leadEmail,
        idempotency_key: idempotencyKey,
        payload: payload,
      });

    if (logError) {
      if (logError.code === "23505") {
        console.log(`[SmartLead Webhook] Concurrent duplicate event skipped: ${idempotencyKey}`);
        return NextResponse.json({
          success: true,
          message: "Duplicate event, already processed",
          deduplicated: true,
        });
      }
      console.warn("[SmartLead Webhook] Failed to log:", logError.message);
    }

    if (!leadEmail) {
      console.warn("[SmartLead Webhook] No email in payload:", payload);
      return NextResponse.json({
        success: true,
        message: "No email in payload, skipped",
      });
    }

    // Update daily analytics
    await updateDailyAnalytics(
      supabase,
      campaignId,
      normalizedEvent,
      payload.timestamp || new Date().toISOString()
    );

    // Get client info
    const clientId = campaign.client_id;
    let clientName = "";
    if (clientId) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();
      clientName = clientData?.name || "";
    }

    // Try to find existing lead
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, email_open_count, email_click_count, email_reply_count, status, first_name, last_name, company_name, phone")
      .eq("campaign_id", campaignId)
      .eq("email", leadEmail)
      .maybeSingle();

    // Build update data based on event type
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const isReply = normalizedEvent === "reply_received";
    const isEmailSent = normalizedEvent === "email_sent";
    const isEmailOpened = normalizedEvent === "email_opened";
    const isLinkClicked = normalizedEvent === "link_clicked";
    const isBounced = normalizedEvent === "email_bounced";
    const isCategoryChange = normalizedEvent === "lead_category_change";

    let isPositive = false;

    // Handle category changes (SmartLead-specific)
    if (isCategoryChange && payload.category) {
      const { status, isPositiveReply } = mapCategory(payload.category);
      if (status) {
        updateData.status = status;
      }
      if (isPositiveReply !== null) {
        updateData.is_positive_reply = isPositiveReply;
        isPositive = isPositiveReply;
      }
      // Category changes imply the lead has replied
      updateData.has_replied = true;
    }

    // Handle replies
    if (isReply) {
      updateData.has_replied = true;
      updateData.status = "replied";

      // Atomically increment campaign's cached_reply_count
      const { error: rpcErr1 } = await supabase.rpc("increment_campaign_counter", {
        campaign_uuid: campaignId,
        counter_name: "cached_reply_count",
      });
      if (rpcErr1) console.error("[SmartLead Webhook] Failed to increment cached_reply_count:", rpcErr1);
    }

    // Handle email sent
    if (isEmailSent) {
      if (!existingLead || existingLead.status === "new") {
        updateData.status = "contacted";
      }
      // Atomically increment campaign's cached_emails_sent
      const { error: rpcErr2 } = await supabase.rpc("increment_campaign_counter", {
        campaign_uuid: campaignId,
        counter_name: "cached_emails_sent",
      });
      if (rpcErr2) console.error("[SmartLead Webhook] Failed to increment cached_emails_sent:", rpcErr2);
    }

    // Handle bounces
    if (isBounced) {
      updateData.status = "bounced";
      const { error: rpcErr3 } = await supabase.rpc("increment_campaign_counter", {
        campaign_uuid: campaignId,
        counter_name: "cached_emails_bounced",
      });
      if (rpcErr3) console.error("[SmartLead Webhook] Failed to increment cached_emails_bounced:", rpcErr3);
    }

    // Handle email opens
    if (isEmailOpened && existingLead) {
      const currentOpenCount = existingLead.email_open_count || 0;
      updateData.email_open_count = currentOpenCount + 1;
      if (existingLead.status === "contacted" || existingLead.status === "new") {
        updateData.status = "opened";
      }
      // Atomically increment campaign's cached_emails_opened
      const { error: rpcErr4 } = await supabase.rpc("increment_campaign_counter", {
        campaign_uuid: campaignId,
        counter_name: "cached_emails_opened",
      });
      if (rpcErr4) console.error("[SmartLead Webhook] Failed to increment cached_emails_opened:", rpcErr4);
    }

    // Handle link clicks
    if (isLinkClicked && existingLead) {
      const currentClickCount = existingLead.email_click_count || 0;
      updateData.email_click_count = currentClickCount + 1;
      if (
        existingLead.status === "contacted" ||
        existingLead.status === "opened" ||
        existingLead.status === "new"
      ) {
        updateData.status = "clicked";
      }
    }

    // Update or create lead
    let leadDbId: string | null = null;

    if (existingLead) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", existingLead.id);

      if (updateError) {
        console.error("[SmartLead Webhook] Error updating lead:", updateError);
      } else {
        console.log(`[SmartLead Webhook] Updated lead ${leadEmail} - event: ${eventType}`);
        leadDbId = existingLead.id;
      }
    } else if (clientId && (isPositive || isReply || isEmailSent || isCategoryChange)) {
      // Create new lead for meaningful events
      const { data: insertedLead, error: insertError } = await supabase
        .from("leads")
        .insert({
          email: leadEmail,
          campaign_id: campaignId,
          client_id: clientId,
          client_name: clientName,
          campaign_name: campaign.name,
          provider_type: "smartlead",
          provider_lead_id: payload.lead_id ? String(payload.lead_id) : null,
          is_positive_reply: isPositive,
          has_replied: isReply || isPositive,
          status: isPositive || isReply ? "replied" : "contacted",
          ...updateData,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[SmartLead Webhook] Error creating lead:", insertError);
      } else {
        console.log(`[SmartLead Webhook] Created new lead ${leadEmail} from event: ${eventType}`);
        leadDbId = insertedLead?.id || null;
      }
    } else {
      console.warn(`[SmartLead Webhook] Lead not found and not creating for event ${eventType}: ${leadEmail}`);
    }

    // Save email content for reply and sent events
    if (leadDbId && (isReply || isEmailSent)) {
      const emailId = `smartlead-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const subject = payload.subject || null;
      const bodyHtml = payload.body || null;

      if (subject || bodyHtml) {
        const direction = isReply ? "inbound" : "outbound";
        const fromEmail = isReply ? leadEmail : (payload.from_email || "");
        const toEmail = isReply ? (payload.to_email || "") : leadEmail;

        const { error: emailError } = await supabase
          .from("lead_emails")
          .upsert(
            {
              lead_id: leadDbId,
              campaign_id: campaignId,
              provider_email_id: emailId,
              direction,
              from_email: fromEmail,
              to_email: toEmail,
              subject,
              body_html: bodyHtml,
              sent_at: payload.timestamp || new Date().toISOString(),
            },
            {
              onConflict: "provider_email_id",
              ignoreDuplicates: false,
            }
          );

        if (emailError) {
          console.error("[SmartLead Webhook] Error saving email:", emailError);
        } else {
          console.log(`[SmartLead Webhook] Saved ${direction} email for ${leadEmail}`);
        }
      }
    }

    // Send notification and sync to HubSpot for positive replies
    if (isPositive && clientId && leadDbId) {
      // Email notification
      try {
        const leadName = existingLead
          ? [existingLead.first_name, existingLead.last_name].filter(Boolean).join(" ") || undefined
          : undefined;

        const replySnippet = payload.body
          ? payload.body.substring(0, 150) + (payload.body.length > 150 ? "..." : "")
          : undefined;

        // Fetch the full email thread from lead_emails
        let emailThread;
        if (leadDbId) {
          const { data: threadEmails } = await supabase
            .from("lead_emails")
            .select("direction, from_email, to_email, subject, body_text, body_html, sent_at")
            .eq("lead_id", leadDbId)
            .order("sent_at", { ascending: true });
          if (threadEmails && threadEmails.length > 0) {
            emailThread = threadEmails as { direction: "outbound" | "inbound"; from_email: string; to_email: string; subject: string | null; body_text: string | null; body_html: string | null; sent_at: string }[];
          }
        }

        console.log(`[SmartLead Webhook] Sending positive reply notification for ${leadEmail} (thread: ${emailThread?.length || 0} emails)`);

        const notificationResult = await sendPositiveReplyNotification({
          leadEmail,
          leadName,
          leadPhone: existingLead?.phone || undefined,
          companyName: existingLead?.company_name || undefined,
          campaignName: campaign.name,
          clientId,
          clientName,
          replySnippet,
          emailThread,
        });

        if (notificationResult.success) {
          console.log(`[SmartLead Webhook] Notification sent to: ${notificationResult.sentTo.join(", ")}`);
        } else {
          console.error(`[SmartLead Webhook] Failed to send notification: ${notificationResult.error}`);
        }
      } catch (notifyError) {
        console.error("[SmartLead Webhook] Error sending notification:", notifyError);
      }

      // HubSpot sync
      try {
        const emailThread = await getEmailThreadForLead(leadDbId);

        const hubspotResult = await syncLeadToHubSpot({
          leadEmail,
          leadFirstName: existingLead?.first_name || undefined,
          leadLastName: existingLead?.last_name || undefined,
          leadPhone: existingLead?.phone || undefined,
          companyName: existingLead?.company_name || undefined,
          campaignName: campaign.name,
          clientId,
          clientName,
          vertical: campaign.hubspot_vertical || undefined,
          emailThread,
        });

        if (hubspotResult.success) {
          if (hubspotResult.skipped) {
            console.log(`[SmartLead Webhook] HubSpot sync skipped (not enabled for client)`);
          } else {
            console.log(`[SmartLead Webhook] HubSpot sync complete - Contact: ${hubspotResult.contactId}`);
          }
        } else {
          console.error(`[SmartLead Webhook] HubSpot sync failed: ${hubspotResult.error}`);
        }
      } catch (hubspotError) {
        console.error("[SmartLead Webhook] Error syncing to HubSpot:", hubspotError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SmartLead Webhook] Processed in ${duration}ms`);

    // Update webhook log with processing result
    if (leadEmail) {
      await supabase
        .from("webhook_logs")
        .update({
          processing_duration_ms: duration,
          success: true,
        })
        .eq("campaign_id", campaignId)
        .eq("lead_email", leadEmail)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return NextResponse.json({
      success: true,
      campaign: campaign.name,
      event_type: eventType,
      normalized_event: normalizedEvent,
      lead_email: leadEmail,
      is_positive: isPositive,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[SmartLead Webhook] Error processing webhook:", error);

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

    // Return 200 to prevent SmartLead from retrying
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
      .select("id, name, provider_campaign_id")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const webhookUrl = `${url.protocol}//${url.host}/api/webhooks/smartlead/${campaignId}`;

    return NextResponse.json({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      provider_campaign_id: campaign.provider_campaign_id,
      webhook_url: webhookUrl,
      supported_events: {
        tracking: ["EMAIL_SENT", "EMAIL_OPEN", "EMAIL_LINK_CLICK", "EMAIL_BOUNCED"],
        replies: ["EMAIL_REPLY"],
        categories: ["LEAD_CATEGORY_CHANGE"],
        other: ["LEAD_UNSUBSCRIBED"],
      },
      category_mapping: {
        INTERESTED: "replied (positive)",
        MEETING_BOOKED: "booked (positive)",
        MEETING_COMPLETED: "booked (positive)",
        CLOSED: "won (positive)",
        NOT_INTERESTED: "not_interested (negative)",
        WRONG_PERSON: "lost (negative)",
        DO_NOT_CONTACT: "lost (negative)",
        NOT_NOW: "replied (negative)",
      },
      instructions:
        "Configure this URL in your SmartLead campaign webhook settings. Enable EMAIL_REPLY and LEAD_CATEGORY_CHANGE events for lead tracking. Enable EMAIL_SENT, EMAIL_OPEN, EMAIL_LINK_CLICK for engagement metrics.",
    });
  } catch (error) {
    console.error("[SmartLead Webhook] Error fetching campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
