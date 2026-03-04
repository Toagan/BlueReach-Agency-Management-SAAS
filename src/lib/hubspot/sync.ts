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
  vertical?: string; // Industry/vertical for HubSpot (e.g., "Fintechs", "Universities")
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
  dealId?: string;
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
    vertical,
    emailThread,
  } = params;

  const supabase = getSupabase();

  try {
    // Resolve owner_id for settings scoping
    const { data: clientRow } = await supabase
      .from("clients")
      .select("owner_id")
      .eq("id", clientId)
      .single();
    const ownerId = clientRow?.owner_id || null;

    // Batch-read all HubSpot settings for this client
    const settingKeys = [
      `client_${clientId}_hubspot_enabled`,
      `client_${clientId}_hubspot_access_token`,
      `client_${clientId}_hubspot_contact_properties`,
      `client_${clientId}_hubspot_create_contacts`,
      `client_${clientId}_hubspot_create_deals`,
      `client_${clientId}_hubspot_deal_value`,
    ];
    let sq = supabase.from("settings").select("key, value").in("key", settingKeys);
    if (ownerId) sq = sq.eq("owner_id", ownerId);
    const { data: allSettings } = await sq;
    const sm = new Map(allSettings?.map((r) => [r.key, r.value]) || []);

    if (sm.get(`client_${clientId}_hubspot_enabled`) !== "true") {
      return { success: true, skipped: true };
    }

    const accessToken = sm.get(`client_${clientId}_hubspot_access_token`);
    if (!accessToken) {
      console.log(`[HubSpot] No access token configured for client ${clientId}`);
      return { success: true, skipped: true };
    }

    const hubspot = new HubSpotClient(accessToken);

    let contactPropertyMappings: Record<string, string> = {
      hs_lead_status: "Email Outbound (pos. reply)",
    };
    const contactPropsRaw = sm.get(`client_${clientId}_hubspot_contact_properties`);
    if (contactPropsRaw) {
      try {
        contactPropertyMappings = JSON.parse(contactPropsRaw);
      } catch {
        // Fallback to default if JSON is invalid
      }
    }

    // Defaults: contacts on, deals off
    const shouldCreateContacts = sm.get(`client_${clientId}_hubspot_create_contacts`) !== "false";
    const shouldCreateDeals = sm.get(`client_${clientId}_hubspot_create_deals`) === "true";
    const dealValue = sm.get(`client_${clientId}_hubspot_deal_value`) || undefined;

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

    let contactId: string | undefined;
    let noteId: string | undefined;
    let dealId: string | undefined;

    // Conditionally create/update contact
    if (shouldCreateContacts) {
      // Build contact data with email thread in description/notes field
      const contactInput: HubSpotContactInput = {
        properties: {
          email: leadEmail,
          firstname: leadFirstName || undefined,
          lastname: leadLastName || undefined,
          phone: leadPhone || undefined,
          company: companyName || undefined,
          // Configurable contact property mappings (replaces hardcoded hs_lead_status)
          ...contactPropertyMappings,
          // Vertical/Industry - set per campaign
          industry: vertical || undefined,
          // Campaign name for tracking
          campaign_name: campaignName || undefined,
          // Store email thread in HubSpot's built-in notes/description field
          hs_content_membership_notes: emailThreadContent,
          // Also try message field as backup
          message: emailThreadContent.substring(0, 65000), // HubSpot field limit
        },
      };

      // Upsert contact (create or update)
      console.log(`[HubSpot] Upserting contact: ${leadEmail}`);
      const contact = await hubspot.upsertContact(contactInput);
      contactId = contact.id;
      console.log(`[HubSpot] Contact upserted: ${contact.id}`);

      // Try to create a note on the contact
      try {
        const note = await hubspot.createNote(contact.id, emailThreadContent);
        noteId = note.id;
        console.log(`[HubSpot] Note created: ${note.id}`);
      } catch (noteError) {
        console.log(`[HubSpot] Note creation skipped (scope not available), contact created successfully`);
      }
    }

    // Conditionally create deal (requires a contact to associate with)
    if (shouldCreateDeals && contactId) {
      try {
        // Load deal pipeline/stage settings
        let pq = supabase.from("settings").select("value").eq("key", `client_${clientId}_hubspot_deal_pipeline`);
        if (ownerId) pq = pq.eq("owner_id", ownerId);
        const { data: pipelineSetting } = await pq.single();

        let stq = supabase.from("settings").select("value").eq("key", `client_${clientId}_hubspot_deal_stage`);
        if (ownerId) stq = stq.eq("owner_id", ownerId);
        const { data: stageSetting } = await stq.single();

        const pipeline = pipelineSetting?.value || "default";
        const dealstage = stageSetting?.value || "appointmentscheduled";

        const dealName = `${companyName || leadEmail} - ${campaignName}`;
        console.log(`[HubSpot] Creating deal: ${dealName}`);
        const dealResult = await hubspot.createDealForContact(
          contactId,
          dealName,
          dealValue,
          emailThreadContent,
          pipeline,
          dealstage,
        );
        dealId = dealResult.dealId;
        console.log(`[HubSpot] Deal created: ${dealId}`);
      } catch (dealError) {
        console.error(`[HubSpot] Deal creation failed:`, dealError);
        // Don't break the sync if deal creation fails
      }
    }

    // Update sync stats
    const syncCountKey = `client_${clientId}_hubspot_sync_count`;
    let cq = supabase.from("settings").select("value").eq("key", syncCountKey);
    if (ownerId) cq = cq.eq("owner_id", ownerId);
    const { data: currentCount } = await cq.single();

    const newCount = (currentCount?.value ? parseInt(currentCount.value, 10) : 0) + 1;

    await supabase.from("settings").upsert(
      {
        key: syncCountKey,
        value: String(newCount),
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,owner_id" }
    );

    // Update last sync timestamp
    await supabase.from("settings").upsert(
      {
        key: `client_${clientId}_hubspot_last_sync`,
        value: new Date().toISOString(),
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,owner_id" }
    );

    return {
      success: true,
      contactId,
      noteId,
      dealId,
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
