import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import crypto from "crypto";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify webhook signature from Instantly
async function verifySignature(payload: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  
  const supabase = getSupabase();
  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "instantly_webhook_secret")
    .single();
    
  const secret = setting?.value;
  if (!secret) {
    console.warn("No webhook secret configured, accepting all webhooks");
    return true; // Allow webhooks if no secret is configured
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

interface InstantlyWebhookPayload {
  event_type: string;
  campaign_id?: string;
  lead_email?: string;
  lead?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
  email?: {
    subject?: string;
    body?: string;
    timestamp?: string;
    direction?: "sent" | "received";
  };
  timestamp?: string;
  data?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const signature = headersList.get("x-instantly-signature");
    const rawBody = await request.text();
    
    // Verify signature if configured
    const isValid = await verifySignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    
    const payload: InstantlyWebhookPayload = JSON.parse(rawBody);
    const supabase = getSupabase();
    
    console.log("Received webhook:", payload.event_type, payload);
    
    // Find the campaign and lead
    let campaignId: string | null = null;
    let leadId: string | null = null;
    const leadEmail = payload.lead_email || payload.lead?.email;
    
    if (payload.campaign_id) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id, client_id")
        .eq("instantly_campaign_id", payload.campaign_id)
        .single();
        
      if (campaign) {
        campaignId = campaign.id;
        
        // Find the lead
        if (leadEmail) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id")
            .eq("campaign_id", campaignId)
            .eq("email", leadEmail)
            .single();
            
          if (lead) {
            leadId = lead.id;
          }
        }
      }
    }
    
    // Handle different event types
    switch (payload.event_type) {
      case "email_sent":
        if (leadId) {
          await supabase.from("leads").update({
            status: "contacted",
            last_contacted_at: payload.timestamp || new Date().toISOString(),
          }).eq("id", leadId);
          
          // Store the email in lead_emails if email data is provided
          if (payload.email) {
            await supabase.from("lead_emails").insert({
              lead_id: leadId,
              direction: "sent",
              subject: payload.email.subject || "Outreach Email",
              body: payload.email.body || "",
              sent_at: payload.email.timestamp || payload.timestamp,
            });
          }
        }
        break;
        
      case "email_opened":
        if (leadId) {
          await supabase.from("leads").update({
            status: "contacted",
            // Increment open count if we had that field
          }).eq("id", leadId);
        }
        break;
        
      case "link_clicked":
        if (leadId) {
          // Could add clicked_at timestamp
          await supabase.from("leads").update({
            // status stays as contacted
          }).eq("id", leadId);
        }
        break;
        
      case "reply_received":
      case "lead_replied":
        if (leadId) {
          await supabase.from("leads").update({
            status: "replied",
            has_replied: true,
            email_reply_count: supabase.rpc ? undefined : 1, // Increment would need RPC
          }).eq("id", leadId);
          
          // Store the reply email
          if (payload.email) {
            await supabase.from("lead_emails").insert({
              lead_id: leadId,
              direction: "received",
              subject: payload.email.subject || "Re: Outreach",
              body: payload.email.body || "",
              sent_at: payload.email.timestamp || payload.timestamp,
            });
          }
        }
        break;
        
      case "lead_interested":
      case "positive_reply":
        if (leadId) {
          await supabase.from("leads").update({
            status: "replied",
            is_positive_reply: true,
            has_replied: true,
          }).eq("id", leadId);
        }
        break;
        
      case "lead_not_interested":
      case "negative_reply":
        if (leadId) {
          await supabase.from("leads").update({
            status: "closed_lost",
            has_replied: true,
          }).eq("id", leadId);
        }
        break;
        
      case "meeting_booked":
        if (leadId) {
          await supabase.from("leads").update({
            status: "meeting",
            is_positive_reply: true,
            meeting_at: payload.timestamp || null,
          }).eq("id", leadId);
        }
        break;
        
      case "lead_bounced":
        // Could mark lead as bounced
        break;
        
      default:
        console.log("Unhandled event type:", payload.event_type);
    }
    
    // Log the webhook event
    await supabase.from("webhook_logs").insert({
      source: "instantly",
      event_type: payload.event_type,
      payload: payload,
      processed_at: new Date().toISOString(),
    }).catch(() => {
      // webhook_logs table might not exist, that's ok
    });
    
    return NextResponse.json({ success: true, event: payload.event_type });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to check webhook status
export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/webhooks/instantly",
    supported_events: [
      "email_sent",
      "email_opened",
      "link_clicked",
      "reply_received",
      "lead_replied",
      "lead_interested",
      "positive_reply",
      "lead_not_interested",
      "negative_reply",
      "meeting_booked",
      "lead_bounced",
    ],
  });
}
