import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get workspace users with notification preferences (scoped to owner)
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const supabase = getSupabase();

  try {
    // For regular admins, only show their own profile
    // For platform admins, show all profiles
    let profilesQuery = supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("email");

    if (!auth.isPlatformAdmin) {
      profilesQuery = profilesQuery.eq("id", auth.user.id);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get notification preferences from settings (scoped by owner)
    const { data: prefsSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "positive_reply_notification_users")
      .eq("owner_id", auth.user.id)
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

    // If no preferences set yet, default to the current admin
    if (!prefsSetting) {
      enabledUserIds = [auth.user.id];
    }

    // Build user list with enabled status
    const users = profiles?.map((profile) => ({
      id: profile.id,
      email: profile.email,
      name: profile.full_name || profile.email?.split("@")[0] || "Unknown",
      role: profile.role,
      notificationsEnabled: enabledUserIds.includes(profile.id),
    })) || [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error in notification preferences GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

// POST - Update notification preferences (scoped by owner)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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

    // Get current preferences for this owner
    const { data: prefsSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "positive_reply_notification_users")
      .eq("owner_id", auth.user.id)
      .single();

    let enabledUserIds: string[] = [];
    if (prefsSetting?.value) {
      try {
        enabledUserIds = JSON.parse(prefsSetting.value);
      } catch {
        enabledUserIds = [];
      }
    }

    // Update the list
    if (enabled && !enabledUserIds.includes(userId)) {
      enabledUserIds.push(userId);
    } else if (!enabled) {
      enabledUserIds = enabledUserIds.filter((id) => id !== userId);
    }

    // Save back to settings (scoped by owner)
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", "positive_reply_notification_users")
      .eq("owner_id", auth.user.id)
      .single();

    if (existing) {
      const { error: updateError } = await supabase
        .from("settings")
        .update({
          value: JSON.stringify(enabledUserIds),
          updated_at: new Date().toISOString(),
        })
        .eq("key", "positive_reply_notification_users")
        .eq("owner_id", auth.user.id);

      if (updateError) {
        console.error("Error saving preferences:", updateError);
        return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase
        .from("settings")
        .insert({
          key: "positive_reply_notification_users",
          value: JSON.stringify(enabledUserIds),
          owner_id: auth.user.id,
          is_encrypted: false,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Error saving preferences:", insertError);
        return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, enabledUserIds });
  } catch (error) {
    console.error("Error in notification preferences POST:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
