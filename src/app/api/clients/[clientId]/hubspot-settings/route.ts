import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { HubSpotClient } from "@/lib/hubspot";
import { requireClientAccess } from "@/lib/auth";

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

    // Get HubSpot enabled setting
    const enabledKey = `client_${clientId}_hubspot_enabled`;
    const { data: enabledSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", enabledKey)
      .single();

    // Get HubSpot access token (just check if it exists, don't return the actual token)
    const tokenKey = `client_${clientId}_hubspot_access_token`;
    const { data: tokenSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", tokenKey)
      .single();

    // Get last sync timestamp
    const lastSyncKey = `client_${clientId}_hubspot_last_sync`;
    const { data: lastSyncSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", lastSyncKey)
      .single();

    // Get sync count
    const syncCountKey = `client_${clientId}_hubspot_sync_count`;
    const { data: syncCountSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", syncCountKey)
      .single();

    // Get deal pipeline/stage settings
    const { data: pipelineSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", `client_${clientId}_hubspot_deal_pipeline`)
      .single();

    const { data: stageSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", `client_${clientId}_hubspot_deal_stage`)
      .single();

    // Get contact property mappings
    const { data: contactPropsSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", `client_${clientId}_hubspot_contact_properties`)
      .single();

    let contactPropertyMappings: Record<string, string> = {
      hs_lead_status: "Email Outbound (pos. reply)",
    };
    if (contactPropsSetting?.value) {
      try {
        contactPropertyMappings = JSON.parse(contactPropsSetting.value);
      } catch {
        // Fallback to default
      }
    }

    return NextResponse.json({
      enabled: enabledSetting?.value === "true",
      hasAccessToken: !!tokenSetting?.value,
      lastSync: lastSyncSetting?.value || null,
      syncCount: syncCountSetting?.value
        ? parseInt(syncCountSetting.value, 10)
        : 0,
      dealPipeline: pipelineSetting?.value || "default",
      dealStage: stageSetting?.value || "appointmentscheduled",
      contactPropertyMappings,
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
    const { enabled, accessToken, action, dealPipeline, dealStage, contactPropertyMappings } = body as {
      enabled?: boolean;
      accessToken?: string;
      action?: string;
      dealPipeline?: string;
      dealStage?: string;
      contactPropertyMappings?: Record<string, string>;
    };

    const adminSupabase = getSupabaseAdmin();

    // Handle fetchPipelines action
    if (action === "fetchPipelines") {
      const { data: tokenSetting } = await adminSupabase
        .from("settings")
        .select("value")
        .eq("key", `client_${clientId}_hubspot_access_token`)
        .single();

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
      const { data: tokenSetting } = await adminSupabase
        .from("settings")
        .select("value")
        .eq("key", `client_${clientId}_hubspot_access_token`)
        .single();

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
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
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
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }

    // Save deal stage if provided
    if (dealStage !== undefined) {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_deal_stage`,
          value: dealStage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }

    // Save contact property mappings if provided
    if (contactPropertyMappings !== undefined) {
      await adminSupabase.from("settings").upsert(
        {
          key: `client_${clientId}_hubspot_contact_properties`,
          value: JSON.stringify(contactPropertyMappings),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
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

    // Delete all HubSpot-related settings for this client
    const keysToDelete = [
      `client_${clientId}_hubspot_enabled`,
      `client_${clientId}_hubspot_access_token`,
      `client_${clientId}_hubspot_last_sync`,
      `client_${clientId}_hubspot_sync_count`,
      `client_${clientId}_hubspot_deal_pipeline`,
      `client_${clientId}_hubspot_deal_stage`,
      `client_${clientId}_hubspot_contact_properties`,
    ];

    for (const key of keysToDelete) {
      await adminSupabase.from("settings").delete().eq("key", key);
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
