import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { LeadStatus, EmailEventType } from "@/types/database";

// Lazy initialization of Supabase client
let supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

interface InstantlyWebhookPayload {
  event_type: string;
  campaign_id?: string;
  campaign?: { id?: string; name?: string };
  lead?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    lead_id?: string;
  };
  email?: string;
  timestamp?: string;
  subject?: string;
  link_url?: string;
  reply_sentiment?: string; // "positive", "negative", "neutral"
}

interface EventMapping {
  status: LeadStatus | null;
  emailEventType: EmailEventType | null;
  isPositiveReply: boolean;
}

function mapEvent(eventType: string, sentiment?: string): EventMapping {
  switch (eventType) {
    // Email sent events
    case "email_sent":
    case "email.sent":
      return { status: "contacted", emailEventType: "sent", isPositiveReply: false };

    // Email opened
    case "email_opened":
    case "email.opened":
      return { status: "opened", emailEventType: "opened", isPositiveReply: false };

    // Link clicked
    case "email_clicked":
    case "email.clicked":
    case "link_clicked":
    case "link.clicked":
      return { status: "clicked", emailEventType: "clicked", isPositiveReply: false };

    // Reply/interest events - POSITIVE
    case "reply_received":
    case "reply.received":
    case "lead_replied":
      // Check sentiment if available
      const isPositive = sentiment === "positive" || sentiment === "interested";
      return {
        status: "replied",
        emailEventType: "replied",
        isPositiveReply: isPositive || eventType.includes("interested")
      };

    case "lead_interested":
    case "lead.interested":
    case "lead_is_marked_as_interested":
      return { status: "replied", emailEventType: "replied", isPositiveReply: true };

    // Meeting/Booking events - POSITIVE
    case "meeting_booked":
    case "lead_meeting_booked":
    case "lead.meeting_booked":
      return { status: "booked", emailEventType: null, isPositiveReply: true };

    case "meeting_completed":
    case "lead_meeting_completed":
    case "lead.meeting_completed":
      return { status: "won", emailEventType: null, isPositiveReply: true };

    case "lead_closed":
    case "lead.closed":
    case "opportunity_won":
      return { status: "won", emailEventType: null, isPositiveReply: true };

    // Negative events
    case "lead_not_interested":
    case "lead.not_interested":
    case "lead_is_marked_as_not_interested":
      return { status: "not_interested", emailEventType: null, isPositiveReply: false };

    case "lead_unsubscribed":
    case "lead.unsubscribed":
      return { status: "lost", emailEventType: "unsubscribed", isPositiveReply: false };

    // Bounce events
    case "email_bounced":
    case "email.bounced":
      return { status: null, emailEventType: "bounced", isPositiveReply: false };

    // Events we log but don't change status
    case "lead_neutral":
    case "lead.neutral":
    case "lead_out_of_office":
    case "lead_wrong_person":
    case "campaign_completed":
    case "email_account_error":
      return { status: null, emailEventType: null, isPositiveReply: false };

    default:
      console.log("Unknown event type:", eventType);
      return { status: null, emailEventType: null, isPositiveReply: false };
  }
}

export async function POST(request: Request) {
  // Validate webhook secret (check both header and database)
  const webhookSecret = request.headers.get("x-webhook-secret");
  const supabaseClient = getSupabase();

  // Get secret from database if not in env
  let expectedSecret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (!expectedSecret) {
    const { data: setting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "instantly_webhook_secret")
      .single();
    expectedSecret = setting?.value;
  }

  if (expectedSecret && webhookSecret !== expectedSecret) {
    console.error("Invalid webhook secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload: InstantlyWebhookPayload = await request.json();
    console.log("Webhook received:", payload.event_type);

    // Extract campaign ID (Instantly may send it in different formats)
    const campaignId = payload.campaign_id || payload.campaign?.id;

    // Extract lead data
    const leadEmail = payload.lead?.email || payload.email;
    const leadFirstName = payload.lead?.first_name;
    const leadLastName = payload.lead?.last_name;
    const leadCompany = payload.lead?.company_name;
    const leadId = payload.lead?.lead_id;

    // Validate required fields
    if (!campaignId || !leadEmail) {
      console.log("Webhook payload missing fields:", JSON.stringify(payload, null, 2));
      return NextResponse.json(
        { error: "Missing required fields: campaign_id or email", received: { campaignId, leadEmail } },
        { status: 400 }
      );
    }

    // Map the event
    const eventMapping = mapEvent(payload.event_type, payload.reply_sentiment);

    // Find the campaign by Instantly campaign ID
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("campaigns")
      .select("id")
      .eq("instantly_campaign_id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found:", campaignId);
      return NextResponse.json(
        { error: "Campaign not found", campaignId },
        { status: 404 }
      );
    }

    // Check if lead already exists
    const { data: existingLead } = await supabaseClient
      .from("leads")
      .select("id, status, is_positive_reply")
      .eq("campaign_id", campaign.id)
      .eq("email", leadEmail)
      .single();

    let leadDbId: string;

    if (existingLead) {
      leadDbId = existingLead.id;

      // Update lead if status should change
      if (eventMapping.status) {
        const statusOrder: LeadStatus[] = ["contacted", "opened", "clicked", "replied", "booked", "won", "lost", "not_interested"];
        const currentIndex = statusOrder.indexOf(existingLead.status);
        const newIndex = statusOrder.indexOf(eventMapping.status);

        // Only upgrade status (except for lost/not_interested which override)
        const shouldUpdate = eventMapping.status === "lost" ||
          eventMapping.status === "not_interested" ||
          newIndex > currentIndex;

        if (shouldUpdate) {
          const updateData: Record<string, unknown> = {
            status: eventMapping.status,
            updated_at: new Date().toISOString(),
          };

          // Set positive reply flag if this is a positive reply
          if (eventMapping.isPositiveReply && !existingLead.is_positive_reply) {
            updateData.is_positive_reply = true;
          }

          // Update other fields if provided
          if (leadFirstName) updateData.first_name = leadFirstName;
          if (leadLastName) updateData.last_name = leadLastName;
          if (leadCompany) updateData.company_name = leadCompany;
          if (leadId) updateData.instantly_lead_id = leadId;

          await supabaseClient
            .from("leads")
            .update(updateData)
            .eq("id", existingLead.id);
        }
      }
    } else {
      // Create new lead
      const { data: newLead, error: insertError } = await supabaseClient
        .from("leads")
        .insert({
          campaign_id: campaign.id,
          email: leadEmail,
          first_name: leadFirstName || null,
          last_name: leadLastName || null,
          company_name: leadCompany || null,
          status: eventMapping.status || "contacted",
          is_positive_reply: eventMapping.isPositiveReply,
          instantly_lead_id: leadId || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating lead:", insertError);
        return NextResponse.json(
          { error: "Failed to create lead" },
          { status: 500 }
        );
      }

      leadDbId = newLead.id;
    }

    // Log to email_events table if applicable
    if (eventMapping.emailEventType) {
      await supabaseClient.from("email_events").insert({
        lead_id: leadDbId,
        campaign_id: campaign.id,
        event_type: eventMapping.emailEventType,
        email_subject: payload.subject || null,
        link_clicked: payload.link_url || null,
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata: {
          original_event: payload.event_type,
          sentiment: payload.reply_sentiment,
        },
      });
    }

    return NextResponse.json({
      success: true,
      action: existingLead ? "updated" : "created",
      lead_id: leadDbId,
      is_positive_reply: eventMapping.isPositiveReply,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", service: "instantly-webhook" });
}
