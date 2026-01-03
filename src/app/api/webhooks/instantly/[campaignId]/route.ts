import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

    // Get lead email from payload
    const leadEmail = payload.lead_email;

    if (!leadEmail) {
      console.warn("[Webhook] No lead_email in payload:", payload);
      return NextResponse.json({
        success: true,
        message: "No lead_email in payload, skipped"
      });
    }

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

    // Update lead based on the event
    if (isPositive || isNegative) {
      const { data: updatedLead, error: updateError } = await supabase
        .from("leads")
        .update({
          is_positive_reply: isPositive,
          updated_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaignId)
        .eq("email", leadEmail)
        .select("id, email, is_positive_reply")
        .maybeSingle();

      if (updateError) {
        console.error("[Webhook] Error updating lead:", updateError);
      } else if (updatedLead) {
        console.log(`[Webhook] Updated lead ${leadEmail} - is_positive_reply: ${isPositive}`);
      } else {
        console.warn(`[Webhook] Lead not found in DB: ${leadEmail} for campaign ${campaignId}`);
      }
    }

    // Handle reply_received event - update lead status
    if (eventType === "reply_received") {
      const { error: replyError } = await supabase
        .from("leads")
        .update({
          status: "replied",
          updated_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaignId)
        .eq("email", leadEmail);

      if (replyError) {
        console.error("[Webhook] Error updating reply status:", replyError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Processed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      campaign: campaign.name,
      event_type: payload.event_type,
      lead_email: leadEmail,
      is_positive: isPositive,
      processed_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process webhook" },
      { status: 500 }
    );
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
