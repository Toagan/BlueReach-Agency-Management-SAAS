// HubSpot Sync Utilities
// Handles syncing positive replies to HubSpot CRM

import { createClient } from "@supabase/supabase-js";
import { HubSpotClient } from "./client";
import type { HubSpotContactInput } from "./types";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SyncLeadToHubSpotParams {
  leadEmail: string;
  leadFirstName?: string;
  leadLastName?: string;
  leadPhone?: string;
  companyName?: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  emailThread?: Array<{
    direction: "inbound" | "outbound";
    from_email: string;
    to_email: string;
    subject: string | null;
    body_text: string | null;
    sent_at: string;
  }>;
}

interface SyncResult {
  success: boolean;
  contactId?: string;
  noteId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Sync a positive reply lead to HubSpot CRM
 * Creates or updates a contact and adds a note with the email thread
 */
export async function syncLeadToHubSpot(
  params: SyncLeadToHubSpotParams
): Promise<SyncResult> {
  const {
    leadEmail,
    leadFirstName,
    leadLastName,
    leadPhone,
    companyName,
    campaignName,
    clientId,
    clientName,
    emailThread,
  } = params;

  const supabase = getSupabase();

  try {
    // Check if HubSpot is enabled for this client
    const { data: enabledSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", `client_${clientId}_hubspot_enabled`)
      .single();

    if (enabledSetting?.value !== "true") {
      return { success: true, skipped: true };
    }

    // Get the HubSpot access token
    const { data: tokenSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", `client_${clientId}_hubspot_access_token`)
      .single();

    if (!tokenSetting?.value) {
      console.log(`[HubSpot] No access token configured for client ${clientId}`);
      return { success: true, skipped: true };
    }

    const hubspot = new HubSpotClient(tokenSetting.value);

    // Build contact data
    const contactInput: HubSpotContactInput = {
      properties: {
        email: leadEmail,
        firstname: leadFirstName || undefined,
        lastname: leadLastName || undefined,
        phone: leadPhone || undefined,
        company: companyName || undefined,
        lead_source: "BlueReach Outbound",
        campaign_name: campaignName,
      },
    };

    // Upsert contact (create or update)
    console.log(`[HubSpot] Upserting contact: ${leadEmail}`);
    const contact = await hubspot.upsertContact(contactInput);
    console.log(`[HubSpot] Contact upserted: ${contact.id}`);

    // Build note content with email thread
    let noteBody = `**Positive Reply from BlueReach Campaign**\n\n`;
    noteBody += `**Client:** ${clientName}\n`;
    noteBody += `**Campaign:** ${campaignName}\n`;
    noteBody += `**Lead Email:** ${leadEmail}\n`;
    if (companyName) {
      noteBody += `**Company:** ${companyName}\n`;
    }
    noteBody += `\n---\n\n`;

    // Add email thread if available
    if (emailThread && emailThread.length > 0) {
      noteBody += `**Email Thread:**\n\n`;

      // Sort by sent_at ascending (oldest first)
      const sortedEmails = [...emailThread].sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      );

      for (const email of sortedEmails) {
        const date = new Date(email.sent_at).toLocaleString();
        const direction =
          email.direction === "inbound" ? "From Lead" : "To Lead";

        noteBody += `**[${direction}] ${date}**\n`;
        if (email.subject) {
          noteBody += `Subject: ${email.subject}\n`;
        }
        noteBody += `\n${email.body_text || "(No text content)"}\n\n`;
        noteBody += `---\n\n`;
      }
    } else {
      noteBody += `*Email thread not available*\n`;
    }

    noteBody += `\n*Synced from BlueReach at ${new Date().toISOString()}*`;

    // Create note attached to contact
    console.log(`[HubSpot] Creating note for contact: ${contact.id}`);
    const note = await hubspot.createNote(contact.id, noteBody);
    console.log(`[HubSpot] Note created: ${note.id}`);

    // Update sync stats
    const syncCountKey = `client_${clientId}_hubspot_sync_count`;
    const { data: currentCount } = await supabase
      .from("settings")
      .select("value")
      .eq("key", syncCountKey)
      .single();

    const newCount = (currentCount?.value ? parseInt(currentCount.value, 10) : 0) + 1;

    await supabase.from("settings").upsert(
      {
        key: syncCountKey,
        value: String(newCount),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // Update last sync timestamp
    await supabase.from("settings").upsert(
      {
        key: `client_${clientId}_hubspot_last_sync`,
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    return {
      success: true,
      contactId: contact.id,
      noteId: note.id,
    };
  } catch (error) {
    console.error("[HubSpot] Sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get email thread for a lead from the database
 */
export async function getEmailThreadForLead(
  leadId: string
): Promise<
  Array<{
    direction: "inbound" | "outbound";
    from_email: string;
    to_email: string;
    subject: string | null;
    body_text: string | null;
    sent_at: string;
  }>
> {
  const supabase = getSupabase();

  const { data: emails } = await supabase
    .from("lead_emails")
    .select("direction, from_email, to_email, subject, body_text, sent_at")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: true });

  return (emails || []).map((email) => ({
    direction: email.direction as "inbound" | "outbound",
    from_email: email.from_email,
    to_email: email.to_email,
    subject: email.subject,
    body_text: email.body_text,
    sent_at: email.sent_at,
  }));
}
