// Dynamic Multi-Provider Webhook Handler
// Handles webhooks for any provider (Instantly, Smartlead, etc.)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import {
  createProvider,
  type ProviderType,
  type ProviderWebhookPayload,
  type WebhookEventType,
} from "@/lib/providers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SUPPORTED_PROVIDERS: ProviderType[] = ["instantly", "smartlead"];

// Get signature header name for each provider
function getSignatureHeader(provider: ProviderType): string {
  switch (provider) {
    case "instantly":
      return "x-instantly-signature";
    case "smartlead":
      return "x-smartlead-signature";
    default:
      return "x-webhook-signature";
  }
}

// Find campaign by provider campaign ID
async function findCampaign(
  supabase: ReturnType<typeof getSupabase>,
  providerType: ProviderType,
  providerCampaignId: string
) {
  // Try provider_campaign_id first
  let query = supabase
    .from("campaigns")
    .select("id, client_id, webhook_secret, provider_type")
    .eq("provider_type", providerType)
    .eq("provider_campaign_id", providerCampaignId)
    .single();

  let { data: campaign, error } = await query;

  // Fallback to instantly_campaign_id for backwards compatibility
  if (!campaign && providerType === "instantly") {
    const fallback = await supabase
      .from("campaigns")
      .select("id, client_id, webhook_secret, provider_type")
      .eq("instantly_campaign_id", providerCampaignId)
      .single();
    campaign = fallback.data;
    error = fallback.error;
  }

  return campaign;
}

// Find lead by campaign and email
async function findLead(
  supabase: ReturnType<typeof getSupabase>,
  campaignId: string,
  email: string
) {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, email_open_count, email_click_count, email_reply_count")
    .eq("campaign_id", campaignId)
    .eq("email", email)
    .single();

  return lead;
}

// Process webhook event and update database
async function processWebhookEvent(
  supabase: ReturnType<typeof getSupabase>,
  providerType: ProviderType,
  payload: ProviderWebhookPayload,
  campaignId: string,
  leadId: string,
  leadEmail: string
) {
  const now = new Date().toISOString();

  // Log email event
  await supabase.from("email_events").insert({
    lead_id: leadId,
    campaign_id: campaignId,
    event_type: mapEventTypeToDb(payload.eventType),
    provider_type: providerType,
    provider_event_id: payload.providerEventId,
    email_subject: payload.emailSubject,
    link_clicked: payload.linkClicked,
    timestamp: payload.timestamp || now,
    metadata: {
      raw_payload: payload.rawPayload,
      thread_id: payload.threadId,
      sequence_step: payload.sequenceStep,
    },
  });

  // Update lead based on event type
  switch (payload.eventType) {
    case "email_sent":
      await supabase
        .from("leads")
        .update({
          status: "contacted",
          last_contacted_at: payload.timestamp || now,
        })
        .eq("id", leadId);

      // Store outbound email if data provided
      if (payload.emailSubject || payload.emailBody) {
        await storeEmail(supabase, {
          leadId,
          campaignId,
          providerId: payload.providerEventId,
          direction: "outbound",
          fromEmail: payload.emailFrom || "",
          toEmail: leadEmail,
          subject: payload.emailSubject,
          body: payload.emailBody,
          sentAt: payload.timestamp,
          threadId: payload.threadId,
          sequenceStep: payload.sequenceStep,
        });
      }
      break;

    case "email_opened":
      // Increment open count
      const { data: leadForOpen } = await supabase
        .from("leads")
        .select("email_open_count")
        .eq("id", leadId)
        .single();
      if (leadForOpen) {
        await supabase
          .from("leads")
          .update({
            email_open_count: (leadForOpen.email_open_count || 0) + 1,
          })
          .eq("id", leadId);
      }
      break;

    case "link_clicked":
      // Increment click count
      const { data: leadForClick } = await supabase
        .from("leads")
        .select("email_click_count")
        .eq("id", leadId)
        .single();
      if (leadForClick) {
        await supabase
          .from("leads")
          .update({
            email_click_count: (leadForClick.email_click_count || 0) + 1,
          })
          .eq("id", leadId);
      }
      break;

    case "reply_received":
      await supabase
        .from("leads")
        .update({
          status: "replied",
          has_replied: true,
        })
        .eq("id", leadId);

      // Increment reply count
      const { data: leadForReply } = await supabase
        .from("leads")
        .select("email_reply_count")
        .eq("id", leadId)
        .single();
      if (leadForReply) {
        await supabase
          .from("leads")
          .update({
            email_reply_count: (leadForReply.email_reply_count || 0) + 1,
          })
          .eq("id", leadId);
      }

      // Store inbound email
      if (payload.emailSubject || payload.emailBody) {
        await storeEmail(supabase, {
          leadId,
          campaignId,
          providerId: payload.providerEventId,
          direction: "inbound",
          fromEmail: leadEmail,
          toEmail: payload.emailTo || "",
          subject: payload.emailSubject,
          body: payload.emailBody,
          sentAt: payload.timestamp,
          threadId: payload.threadId,
        });
      }
      break;

    case "lead_interested":
      await supabase
        .from("leads")
        .update({
          status: "replied",
          is_positive_reply: true,
          has_replied: true,
        })
        .eq("id", leadId);
      break;

    case "lead_not_interested":
      await supabase
        .from("leads")
        .update({
          status: "not_interested",
          has_replied: true,
        })
        .eq("id", leadId);
      break;

    case "meeting_booked":
      await supabase
        .from("leads")
        .update({
          status: "booked",
          is_positive_reply: true,
        })
        .eq("id", leadId);
      break;

    case "email_bounced":
      // Log bounce but don't change lead status drastically
      await supabase
        .from("leads")
        .update({
          metadata: {
            bounced: true,
            bounce_type: payload.bounceType,
            bounce_reason: payload.bounceReason,
            bounced_at: payload.timestamp,
          },
        })
        .eq("id", leadId);
      break;

    case "unsubscribed":
      await supabase
        .from("leads")
        .update({
          metadata: {
            unsubscribed: true,
            unsubscribed_at: payload.timestamp,
          },
        })
        .eq("id", leadId);
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${payload.eventType}`);
  }
}

// Store email in lead_emails table
async function storeEmail(
  supabase: ReturnType<typeof getSupabase>,
  params: {
    leadId: string;
    campaignId: string;
    providerId?: string;
    direction: "inbound" | "outbound";
    fromEmail: string;
    toEmail: string;
    subject?: string;
    body?: string;
    sentAt?: string;
    threadId?: string;
    sequenceStep?: number;
  }
) {
  // Check if email already exists
  if (params.providerId) {
    const { data: existing } = await supabase
      .from("lead_emails")
      .select("id")
      .eq("lead_id", params.leadId)
      .eq("provider_email_id", params.providerId)
      .single();

    if (existing) return; // Already stored
  }

  await supabase.from("lead_emails").insert({
    lead_id: params.leadId,
    campaign_id: params.campaignId,
    provider_email_id: params.providerId,
    provider_thread_id: params.threadId,
    direction: params.direction,
    from_email: params.fromEmail,
    to_email: params.toEmail,
    subject: params.subject || (params.direction === "inbound" ? "Reply" : "Outreach"),
    body_text: params.body,
    sent_at: params.sentAt || new Date().toISOString(),
    sequence_step: params.sequenceStep,
  });
}

// Map webhook event type to database event type
function mapEventTypeToDb(
  eventType: WebhookEventType
): "sent" | "opened" | "clicked" | "replied" | "bounced" | "unsubscribed" | "spam_complaint" {
  switch (eventType) {
    case "email_sent":
      return "sent";
    case "email_opened":
      return "opened";
    case "link_clicked":
      return "clicked";
    case "reply_received":
    case "lead_interested":
    case "lead_not_interested":
      return "replied";
    case "email_bounced":
      return "bounced";
    case "unsubscribed":
      return "unsubscribed";
    default:
      return "sent";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Validate provider
    if (!SUPPORTED_PROVIDERS.includes(provider as ProviderType)) {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    const providerType = provider as ProviderType;
    const headersList = await headers();
    const signature = headersList.get(getSignatureHeader(providerType));
    const rawBody = await request.text();

    const supabase = getSupabase();

    // Parse webhook payload using provider-specific logic
    // For now, we'll use a temporary API key just for parsing (we'll verify per-campaign)
    let webhookPayload: ProviderWebhookPayload;
    try {
      // Create a temporary provider instance for parsing
      const tempProvider = createProvider(providerType, "temp-key-for-parsing");
      webhookPayload = tempProvider.parseWebhookPayload(rawBody, {
        signature: signature || "",
      });
    } catch (error) {
      console.error(`[Webhook] Failed to parse ${provider} webhook:`, error);
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received ${provider} event: ${webhookPayload.eventType}`);

    // Find the campaign
    if (!webhookPayload.campaignId) {
      console.log("[Webhook] No campaign ID in webhook payload");
      return NextResponse.json({ success: true, message: "No campaign ID" });
    }

    const campaign = await findCampaign(supabase, providerType, webhookPayload.campaignId);
    if (!campaign) {
      console.log(`[Webhook] Campaign not found for provider campaign: ${webhookPayload.campaignId}`);
      return NextResponse.json({ success: true, message: "Campaign not found" });
    }

    // Verify signature using campaign-specific secret
    if (campaign.webhook_secret && signature) {
      const tempProvider = createProvider(providerType, "temp-key-for-verify");
      const isValid = tempProvider.verifyWebhookSignature(
        rawBody,
        signature,
        campaign.webhook_secret
      );
      if (!isValid) {
        console.log("[Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Find the lead
    if (!webhookPayload.leadEmail) {
      console.log("[Webhook] No lead email in webhook payload");
      return NextResponse.json({ success: true, message: "No lead email" });
    }

    const lead = await findLead(supabase, campaign.id, webhookPayload.leadEmail);
    if (!lead) {
      console.log(`[Webhook] Lead not found: ${webhookPayload.leadEmail}`);
      return NextResponse.json({ success: true, message: "Lead not found" });
    }

    // Process the event
    await processWebhookEvent(
      supabase,
      providerType,
      webhookPayload,
      campaign.id,
      lead.id,
      webhookPayload.leadEmail
    );

    return NextResponse.json({
      success: true,
      event: webhookPayload.eventType,
      provider: providerType,
    });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to check webhook status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!SUPPORTED_PROVIDERS.includes(provider as ProviderType)) {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    status: "active",
    provider,
    endpoint: `/api/webhooks/${provider}`,
    supported_events: [
      "email_sent",
      "email_opened",
      "link_clicked",
      "reply_received",
      "lead_interested",
      "lead_not_interested",
      "meeting_booked",
      "email_bounced",
      "unsubscribed",
    ],
  });
}
