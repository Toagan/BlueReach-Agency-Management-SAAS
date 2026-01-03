import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import crypto from "crypto";
import { fetchEmailsForLead as fetchInstantlyEmails } from "@/lib/instantly";

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
    id?: string;
    subject?: string;
    body?: string;
    body_text?: string;
    body_html?: string;
    from_email?: string;
    to_email?: string;
    timestamp?: string;
    direction?: "sent" | "received" | "outbound" | "inbound";
  };
  timestamp?: string;
  data?: Record<string, unknown>;
}

// Helper function to sync all emails for a lead from Instantly
async function syncEmailThreadForLead(
  supabase: ReturnType<typeof getSupabase>,
  leadId: string,
  leadEmail: string,
  campaignId: string
) {
  try {
    const instantlyEmails = await fetchInstantlyEmails(leadEmail);

    for (const email of instantlyEmails) {
      // Check if email already exists
      const { data: existing } = await supabase
        .from("lead_emails")
        .select("id")
        .eq("lead_id", leadId)
        .eq("provider_email_id", email.id)
        .single();

      if (existing) continue;

      // Determine direction
      const isOutbound = email.from_address_email !== leadEmail;
      const toEmail = email.to_address_email_list?.[0] || leadEmail;

      // Insert email
      await supabase.from("lead_emails").insert({
        lead_id: leadId,
        campaign_id: campaignId,
        provider_email_id: email.id,
        provider_thread_id: email.thread_id || null,
        direction: isOutbound ? "outbound" : "inbound",
        from_email: email.from_address_email || "",
        to_email: toEmail,
        subject: email.subject || null,
        body_text: email.body?.text || null,
        body_html: email.body?.html || email.body?.text || null,
        sent_at: email.timestamp_email || email.timestamp_created || null,
        metadata: {
          instantly_data: {
            campaign_id: email.i_campaign,
            eaccount: email.eaccount,
            is_reply: email.is_reply,
          },
        },
      });
    }

    console.log(`Synced ${instantlyEmails.length} emails for lead ${leadEmail}`);
  } catch (error) {
    console.error("Failed to sync email thread:", error);
  }
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
        if (leadId && campaignId) {
          await supabase.from("leads").update({
            status: "contacted",
            last_contacted_at: payload.timestamp || new Date().toISOString(),
          }).eq("id", leadId);

          // Store the email in lead_emails if email data is provided
          if (payload.email) {
            // Check if this email already exists (by provider_email_id if available)
            if (payload.email.id) {
              const { data: existing } = await supabase
                .from("lead_emails")
                .select("id")
                .eq("lead_id", leadId)
                .eq("provider_email_id", payload.email.id)
                .single();

              if (existing) break; // Already exists
            }

            await supabase.from("lead_emails").insert({
              lead_id: leadId,
              campaign_id: campaignId,
              provider_email_id: payload.email.id || null,
              direction: "outbound",
              from_email: payload.email.from_email || "",
              to_email: payload.email.to_email || leadEmail || "",
              subject: payload.email.subject || "Outreach Email",
              body_text: payload.email.body_text || payload.email.body || "",
              body_html: payload.email.body_html || null,
              sent_at: payload.email.timestamp || payload.timestamp,
            });
          }
        }
        break;

      case "email_opened":
        if (leadId) {
          // Update open count - increment via direct update
          try {
            const { data: lead } = await supabase
              .from("leads")
              .select("email_open_count")
              .eq("id", leadId)
              .single();

            if (lead) {
              await supabase.from("leads").update({
                email_open_count: (lead.email_open_count || 0) + 1,
              }).eq("id", leadId);
            }
          } catch {
            // Ignore errors
          }
        }
        break;

      case "link_clicked":
        if (leadId) {
          // Update click count - increment via direct update
          try {
            const { data: lead } = await supabase
              .from("leads")
              .select("email_click_count")
              .eq("id", leadId)
              .single();

            if (lead) {
              await supabase.from("leads").update({
                email_click_count: (lead.email_click_count || 0) + 1,
              }).eq("id", leadId);
            }
          } catch {
            // Ignore errors
          }
        }
        break;

      case "reply_received":
      case "lead_replied":
        if (leadId && campaignId && leadEmail) {
          await supabase.from("leads").update({
            status: "replied",
            has_replied: true,
          }).eq("id", leadId);

          // Store the reply email if provided
          if (payload.email) {
            // Check if this email already exists
            if (payload.email.id) {
              const { data: existing } = await supabase
                .from("lead_emails")
                .select("id")
                .eq("lead_id", leadId)
                .eq("provider_email_id", payload.email.id)
                .single();

              if (existing) break;
            }

            await supabase.from("lead_emails").insert({
              lead_id: leadId,
              campaign_id: campaignId,
              provider_email_id: payload.email.id || null,
              direction: "inbound",
              from_email: payload.email.from_email || leadEmail,
              to_email: payload.email.to_email || "",
              subject: payload.email.subject || "Re: Outreach",
              body_text: payload.email.body_text || payload.email.body || "",
              body_html: payload.email.body_html || null,
              sent_at: payload.email.timestamp || payload.timestamp,
            });
          }

          // Also sync all emails from Instantly to ensure we have the full thread
          await syncEmailThreadForLead(supabase, leadId, leadEmail, campaignId);
        }
        break;

      case "lead_interested":
      case "positive_reply":
        if (leadId && campaignId && leadEmail) {
          await supabase.from("leads").update({
            status: "replied",
            is_positive_reply: true,
            has_replied: true,
          }).eq("id", leadId);

          // Auto-sync the full email thread when a positive reply is received
          await syncEmailThreadForLead(supabase, leadId, leadEmail, campaignId);
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
    try {
      await supabase.from("webhook_logs").insert({
        source: "instantly",
        event_type: payload.event_type,
        payload: payload,
        processed_at: new Date().toISOString(),
      });
    } catch {
      // webhook_logs table might not exist, that's ok
    }
    
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
