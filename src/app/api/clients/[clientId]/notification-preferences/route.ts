import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClientAccess, getClientOwnerId } from "@/lib/auth";

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
  const auth = await requireClientAccess(clientId);
  if (auth.error) return auth.error;
  const supabase = getSupabase();
  const ownerId = await getClientOwnerId(clientId);

  try {
    // Get admin users (always can receive notifications)
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("role", "admin");

    // Get users linked to this specific client with their client-specific role
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("user_id, role, profiles(id, email, full_name, role)")
      .eq("client_id", clientId);

    // Combine admin users and client-specific users (avoiding duplicates)
    // Store both profile data and display role
    const userMap = new Map<string, { id: string; email: string; full_name: string | null; role: string; displayRole: string }>();

    // Add admins first
    adminProfiles?.forEach((profile) => {
      userMap.set(profile.id, { ...profile, displayRole: "admin" });
    });

    // Add client users - show as "external" since they're client team members
    clientUsers?.forEach((cu) => {
      const profile = cu.profiles as unknown as { id: string; email: string; full_name: string | null; role: string } | null;
      if (profile) {
        if (userMap.has(profile.id)) {
          // If admin is also a client user, keep admin role
          // (already added with admin displayRole)
        } else {
          userMap.set(profile.id, { ...profile, displayRole: "external" });
        }
      }
    });

    const profiles = Array.from(userMap.values());

    // Get client-specific notification preferences
    const settingKey = `client_${clientId}_notification_users`;
    let prefsQuery = supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey);

    if (ownerId) prefsQuery = prefsQuery.eq("owner_id", ownerId);

    const { data: prefsSetting } = await prefsQuery.single();

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
        .filter((p) => p.role === "admin")
        .map((p) => p.id);
    }

    // Build user list with enabled status
    const users = profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      name: profile.full_name || profile.email?.split("@")[0] || "Unknown",
      role: profile.displayRole,
      notificationsEnabled: enabledUserIds.includes(profile.id),
    }));

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
  const auth = await requireClientAccess(clientId);
  if (auth.error) return auth.error;
  const supabase = getSupabase();
  const ownerId = await getClientOwnerId(clientId);

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
    let prefsQuery = supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey);

    if (ownerId) prefsQuery = prefsQuery.eq("owner_id", ownerId);

    const { data: prefsSetting } = await prefsQuery.single();

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
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "key,owner_id",
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
