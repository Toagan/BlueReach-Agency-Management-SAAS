import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { HubSpotClient } from "@/lib/hubspot";

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
    const supabase = await createServerClient();

    // Verify user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

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

    return NextResponse.json({
      enabled: enabledSetting?.value === "true",
      hasAccessToken: !!tokenSetting?.value,
      lastSync: lastSyncSetting?.value || null,
      syncCount: syncCountSetting?.value
        ? parseInt(syncCountSetting.value, 10)
        : 0,
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
    const body = await request.json();
    const { enabled, accessToken } = body as {
      enabled?: boolean;
      accessToken?: string;
    };

    const supabase = await createServerClient();

    // Verify user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const adminSupabase = getSupabaseAdmin();

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
    const supabase = await createServerClient();

    // Verify user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const adminSupabase = getSupabaseAdmin();

    // Delete all HubSpot-related settings for this client
    const keysToDelete = [
      `client_${clientId}_hubspot_enabled`,
      `client_${clientId}_hubspot_access_token`,
      `client_${clientId}_hubspot_last_sync`,
      `client_${clientId}_hubspot_sync_count`,
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
