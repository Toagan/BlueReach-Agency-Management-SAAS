import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

// GET - Get notification preferences for this client
export async function GET(request: Request, { params }: RouteParams) {
  const { clientId } = await params;
  const supabase = getSupabase();

  try {
    // Get all profiles (potential notification recipients)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("email");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get client-specific notification preferences
    const settingKey = `client_${clientId}_notification_users`;
    const { data: prefsSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey)
      .single();

    // Parse the preferences (stored as JSON array of user IDs)
    let enabledUserIds: string[] = [];
    if (prefsSetting?.value) {
      try {
        enabledUserIds = JSON.parse(prefsSetting.value);
      } catch {
        enabledUserIds = [];
      }
    }

    // If no preferences set yet, default to all admin users enabled
    if (!prefsSetting) {
      enabledUserIds = profiles
        ?.filter((p) => p.role === "admin")
        .map((p) => p.id) || [];
    }

    // Build user list with enabled status
    const users = profiles?.map((profile) => ({
      id: profile.id,
      email: profile.email,
      name: profile.full_name || profile.email?.split("@")[0] || "Unknown",
      role: profile.role,
      notificationsEnabled: enabledUserIds.includes(profile.id),
    })) || [];

    return NextResponse.json({ users, clientId });
  } catch (error) {
    console.error("Error in client notification preferences GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

// POST - Update notification preferences for this client
export async function POST(request: Request, { params }: RouteParams) {
  const { clientId } = await params;
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { userId, enabled } = body;

    if (!userId || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "userId and enabled are required" },
        { status: 400 }
      );
    }

    const settingKey = `client_${clientId}_notification_users`;

    // Get current preferences
    const { data: prefsSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey)
      .single();

    let enabledUserIds: string[] = [];
    if (prefsSetting?.value) {
      try {
        enabledUserIds = JSON.parse(prefsSetting.value);
      } catch {
        enabledUserIds = [];
      }
    } else {
      // If no setting exists yet, start with all admins
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      enabledUserIds = adminProfiles?.map((p) => p.id) || [];
    }

    // Update the list
    if (enabled && !enabledUserIds.includes(userId)) {
      enabledUserIds.push(userId);
    } else if (!enabled) {
      enabledUserIds = enabledUserIds.filter((id) => id !== userId);
    }

    // Save back to settings
    const { error: upsertError } = await supabase
      .from("settings")
      .upsert({
        key: settingKey,
        value: JSON.stringify(enabledUserIds),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "key",
      });

    if (upsertError) {
      console.error("Error saving preferences:", upsertError);
      return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabledUserIds });
  } catch (error) {
    console.error("Error in client notification preferences POST:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
