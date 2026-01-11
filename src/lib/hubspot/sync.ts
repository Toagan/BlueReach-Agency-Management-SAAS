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

    // Build email thread content for the contact description
    let emailThreadContent = `POSITIVE REPLY - BlueReach Campaign\n`;
    emailThreadContent += `Client: ${clientName}\n`;
    emailThreadContent += `Campaign: ${campaignName}\n`;
    if (companyName) {
      emailThreadContent += `Company: ${companyName}\n`;
    }
    emailThreadContent += `\n--- EMAIL THREAD ---\n\n`;

    // Add email thread if available
    if (emailThread && emailThread.length > 0) {
      // Sort by sent_at ascending (oldest first)
      const sortedEmails = [...emailThread].sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      );

      for (const email of sortedEmails) {
        const date = new Date(email.sent_at).toLocaleString();
        const direction =
          email.direction === "inbound" ? "FROM LEAD" : "TO LEAD";

        emailThreadContent += `[${direction}] ${date}\n`;
        if (email.subject) {
          emailThreadContent += `Subject: ${email.subject}\n`;
        }
        emailThreadContent += `${email.body_text || "(No text content)"}\n\n`;
        emailThreadContent += `---\n\n`;
      }
    } else {
      emailThreadContent += `(Email thread not available)\n`;
    }

    emailThreadContent += `\nSynced from BlueReach at ${new Date().toISOString()}`;

    // Build contact data with email thread in description/notes field
    const contactInput: HubSpotContactInput = {
      properties: {
        email: leadEmail,
        firstname: leadFirstName || undefined,
        lastname: leadLastName || undefined,
        phone: leadPhone || undefined,
        company: companyName || undefined,
        // Store email thread in HubSpot's built-in notes/description field
        hs_content_membership_notes: emailThreadContent,
        // Also try message field as backup
        message: emailThreadContent.substring(0, 65000), // HubSpot field limit
      },
    };

    // Upsert contact (create or update)
    console.log(`[HubSpot] Upserting contact: ${leadEmail}`);
    const contact = await hubspot.upsertContact(contactInput);
    console.log(`[HubSpot] Contact upserted: ${contact.id}`);

    // Try to create a note if the scope is available (will fail gracefully if not)
    let noteId: string | undefined;
    try {
      const note = await hubspot.createNote(contact.id, emailThreadContent);
      noteId = note.id;
      console.log(`[HubSpot] Note created: ${note.id}`);
    } catch (noteError) {
      // Note creation failed (likely scope not available), but contact was created
      console.log(`[HubSpot] Note creation skipped (scope not available), contact created successfully`);
    }

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
      noteId,
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
