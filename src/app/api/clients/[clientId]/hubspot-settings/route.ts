import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { HubSpotClient } from "@/lib/hubspot";
import { requireClientAccess, getClientOwnerId } from "@/lib/auth";
import { sendHubSpotSetupEmail } from "@/lib/email/send";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get HubSpot settings for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const adminSupabase = getSupabaseAdmin();
    const ownerId = await getClientOwnerId(clientId);

    // Batch-read all HubSpot settings for this client
    const keys = [
      `client_${clientId}_hubspot_enabled`,
      `client_${clientId}_hubspot_access_token`,
      `client_${clientId}_hubspot_last_sync`,
      `client_${clientId}_hubspot_sync_count`,
      `client_${clientId}_hubspot_deal_pipeline`,
      `client_${clientId}_hubspot_deal_stage`,
      `client_${clientId}_hubspot_contact_properties`,
      `client_${clientId}_hubspot_create_contacts`,
      `client_${clientId}_hubspot_create_deals`,
      `client_${clientId}_hubspot_deal_value`,
      `client_${clientId}_hubspot_setup_email_sent`,
    ];

    let settingsQuery = adminSupabase
      .from("settings")
      .select("key, value")
      .in("key", keys);
    if (ownerId) settingsQuery = settingsQuery.eq("owner_id", ownerId);
    const { data: settings } = await settingsQuery;

    const s = new Map(settings?.map((r) => [r.key, r.value]) || []);

    let contactPropertyMappings: Record<string, string> = {
      hs_lead_status: "Email Outbound (pos. reply)",
    };
    const contactPropsRaw = s.get(`client_${clientId}_hubspot_contact_properties`);
    if (contactPropsRaw) {
      try {
        contactPropertyMappings = JSON.parse(contactPropsRaw);
      } catch {
        // Fallback to default
      }
    }

    return NextResponse.json({
      enabled: s.get(`client_${clientId}_hubspot_enabled`) === "true",
      hasAccessToken: !!s.get(`client_${clientId}_hubspot_access_token`),
      lastSync: s.get(`client_${clientId}_hubspot_last_sync`) || null,
      syncCount: s.get(`client_${clientId}_hubspot_sync_count`)
        ? parseInt(s.get(`client_${clientId}_hubspot_sync_count`)!, 10)
        : 0,
      dealPipeline: s.get(`client_${clientId}_hubspot_deal_pipeline`) || "default",
      dealStage: s.get(`client_${clientId}_hubspot_deal_stage`) || "appointmentscheduled",
      contactPropertyMappings,
      createContacts: s.get(`client_${clientId}_hubspot_create_contacts`) !== "false", // default true
      createDeals: s.get(`client_${clientId}_hubspot_create_deals`) === "true", // default false
      dealValue: s.get(`client_${clientId}_hubspot_deal_value`) || "",
      setupEmailSent: s.get(`client_${clientId}_hubspot_setup_email_sent`) || null,
    });
  } catch (error) {
    console.error("Error fetching HubSpot settings:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

// POST - Update HubSpot settings for a client
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { enabled, accessToken, action, dealPipeline, dealStage, contactPropertyMappings, createContacts, createDeals, dealValue, setupEmailTo } = body as {
      enabled?: boolean;
      accessToken?: string;
      action?: string;
      dealPipeline?: string;
      dealStage?: string;
      contactPropertyMappings?: Record<string, string>;
      createContacts?: boolean;
      createDeals?: boolean;
      dealValue?: string;
      setupEmailTo?: string;
    };

    const adminSupabase = getSupabaseAdmin();
    const ownerId = await getClientOwnerId(clientId);

    // Handle sendSetupEmail action
    if (action === "sendSetupEmail") {
      const { recipientEmail } = body as { recipientEmail?: string };
      const emailTo = recipientEmail || setupEmailTo;
      if (!emailTo) {
        return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
      }

      // Get client name
      const { data: client } = await adminSupabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      const result = await sendHubSpotSetupEmail({
        to: emailTo,
        recipientName: emailTo.split("@")[0],
        clientName: client?.name || "Your Company",
        clientId,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
      }

      // Record when setup email was sent
      await adminSupabase
        .from("settings")
        .upsert({
          key: `client_${clientId}_hubspot_setup_email_sent`,
          value: new Date().toISOString(),
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key,owner_id" });

      return NextResponse.json({ success: true, message: `Setup instructions sent to ${emailTo}` });
    }

    // Handle fetchPipelines action
    if (action === "fetchPipelines") {
      let tq = adminSupabase
        .from("settings")
        .select("value")
        .eq("key", `client_${clientId}_hubspot_access_token`);
      if (ownerId) tq = tq.eq("owner_id", ownerId);
      const { data: tokenSetting } = await tq.single();

      if (!tokenSetting?.value) {
        return NextResponse.json(
          { error: "No HubSpot access token configured" },
          { status: 400 }
        );
      }

      try {
        const hubspotClient = new HubSpotClient(tokenSetting.value);
        const pipelines = await hubspotClient.getPipelines();
        return NextResponse.json({ pipelines });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to fetch pipelines" },
          { status: 500 }
        );
      }
    }

    // Handle fetchContactProperties action
    if (action === "fetchContactProperties") {
      let cpq = adminSupabase
        .from("settings")
        .select("value")
        .eq("key", `client_${clientId}_hubspot_access_token`);
      if (ownerId) cpq = cpq.eq("owner_id", ownerId);
      const { data: tokenSetting } = await cpq.single();

      if (!tokenSetting?.value) {
        return NextResponse.json(
          { error: "No HubSpot access token configured" },
          { status: 400 }
        );
      }

      try {
        const hubspotClient = new HubSpotClient(tokenSetting.value);
        const contactProperties = await hubspotClient.getContactProperties();
        return NextResponse.json({ contactProperties });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to fetch contact properties" },
          { status: 500 }
        );
      }
    }

    // Save contact/deal toggles and deal value
    if (typeof createContacts === "boolean") {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_create_contacts`,
          value: createContacts ? "true" : "false",
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,owner_id" }
      );
    }

    if (typeof createDeals === "boolean") {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_create_deals`,
          value: createDeals ? "true" : "false",
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,owner_id" }
      );
    }

    if (dealValue !== undefined) {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_deal_value`,
          value: dealValue,
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,owner_id" }
      );
    }

    // If access token is provided, validate it first
    if (accessToken) {
      try {
        const hubspotClient = new HubSpotClient(accessToken);
        const testResult = await hubspotClient.testConnection();

        if (!testResult.valid) {
          return NextResponse.json(
            { error: testResult.error || "Invalid HubSpot access token" },
            { status: 400 }
          );
        }

        // Save the access token
        const tokenKey = `client_${clientId}_hubspot_access_token`;
        const { error: tokenError } = await adminSupabase
          .from("settings")
          .upsert(
            {
              key: tokenKey,
              value: accessToken,
              owner_id: ownerId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key,owner_id" }
          );

        if (tokenError) {
          console.error("Error saving HubSpot token:", tokenError);
          return NextResponse.json(
            { error: "Failed to save access token" },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error("Error validating HubSpot token:", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to validate access token",
          },
          { status: 400 }
        );
      }
    }

    // Update enabled setting if provided
    if (typeof enabled === "boolean") {
      const enabledKey = `client_${clientId}_hubspot_enabled`;
      const { error: enabledError } = await adminSupabase
        .from("settings")
        .upsert(
          {
            key: enabledKey,
            value: enabled ? "true" : "false",
            owner_id: ownerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key,owner_id" }
        );

      if (enabledError) {
        console.error("Error saving HubSpot enabled setting:", enabledError);
        return NextResponse.json(
          { error: "Failed to save settings" },
          { status: 500 }
        );
      }
    }

    // Save deal pipeline if provided
    if (dealPipeline !== undefined) {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_deal_pipeline`,
          value: dealPipeline,
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,owner_id" }
      );
    }

    // Save deal stage if provided
    if (dealStage !== undefined) {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_deal_stage`,
          value: dealStage,
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,owner_id" }
      );
    }

    // Save contact property mappings if provided
    if (contactPropertyMappings !== undefined) {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_contact_properties`,
          value: JSON.stringify(contactPropertyMappings),
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key,owner_id" }
      );
    }

    return NextResponse.json({
      success: true,
      message: accessToken
        ? "HubSpot connection verified and saved"
        : "Settings updated",
    });
  } catch (error) {
    console.error("Error saving HubSpot settings:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove HubSpot integration for a client
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const adminSupabase = getSupabaseAdmin();
    const ownerId = await getClientOwnerId(clientId);

    // Delete all HubSpot-related settings for this client
    const keysToDelete = [
      `client_${clientId}_hubspot_enabled`,
      `client_${clientId}_hubspot_access_token`,
      `client_${clientId}_hubspot_last_sync`,
      `client_${clientId}_hubspot_sync_count`,
      `client_${clientId}_hubspot_deal_pipeline`,
      `client_${clientId}_hubspot_deal_stage`,
      `client_${clientId}_hubspot_contact_properties`,
      `client_${clientId}_hubspot_create_contacts`,
      `client_${clientId}_hubspot_create_deals`,
      `client_${clientId}_hubspot_deal_value`,
      `client_${clientId}_hubspot_setup_email_sent`,
    ];

    for (const key of keysToDelete) {
      let dq = adminSupabase.from("settings").delete().eq("key", key);
      if (ownerId) dq = dq.eq("owner_id", ownerId);
      await dq;
    }

    return NextResponse.json({
      success: true,
      message: "HubSpot integration removed",
    });
  } catch (error) {
    console.error("Error removing HubSpot settings:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to remove settings",
      },
      { status: 500 }
    );
  }
}
