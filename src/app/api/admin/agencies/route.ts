import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all agency owners (platform admin only)
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabase();

    // Get all admin profiles (exclude the platform admin's own row)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "admin")
      .neq("id", auth.user.id)
      .order("email");

    if (profilesError) {
      throw profilesError;
    }

    // Get client counts for each agency owner
    const agencies = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { count } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", profile.id);

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          clientCount: count || 0,
          createdAt: null,
        };
      })
    );

    return NextResponse.json({ agencies });
  } catch (error) {
    console.error("Error fetching agencies:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch agencies" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an agency owner and all their data (platform admin only)
export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  try {
    const { agencyId } = await request.json();

    if (!agencyId) {
      return NextResponse.json({ error: "Missing agencyId" }, { status: 400 });
    }

    // Prevent deleting yourself
    if (agencyId === auth.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify the target is actually an admin (not a client user)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", agencyId)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "User is not an agency owner" }, { status: 400 });
    }

    // Get all clients owned by this agency
    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_id", agencyId);

    const clientIds = (clients || []).map((c) => c.id);

    if (clientIds.length > 0) {
      // Get all campaigns for these clients
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id")
        .in("client_id", clientIds);

      const campaignIds = (campaigns || []).map((c) => c.id);

      if (campaignIds.length > 0) {
        // Delete leads and related data for these campaigns
        await supabase.from("lead_emails").delete().in("campaign_id", campaignIds);
        await supabase.from("email_events").delete().in("campaign_id", campaignIds);
        await supabase.from("leads").delete().in("campaign_id", campaignIds);
        await supabase.from("campaign_sequences").delete().in("campaign_id", campaignIds);
        await supabase.from("copy_reviews").delete().in("campaign_id", campaignIds);
        await supabase.from("copy_comments").delete().in("campaign_id", campaignIds);
        await supabase.from("campaigns").delete().in("client_id", clientIds);
      }

      // Delete client-related data
      await supabase.from("client_users").delete().in("client_id", clientIds);
      await supabase.from("client_invitations").delete().in("client_id", clientIds);
      await supabase.from("api_providers").delete().in("client_id", clientIds);
      await supabase.from("clients").delete().eq("owner_id", agencyId);
    }

    // Delete the agency owner's settings
    await supabase.from("settings").delete().eq("owner_id", agencyId);

    // Delete the profile
    await supabase.from("profiles").delete().eq("id", agencyId);

    // Delete the auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(agencyId);
    if (authError) {
      console.error("[DeleteAgency] Error deleting auth user:", authError);
      // Profile already deleted, log but don't fail
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agency:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete agency" },
      { status: 500 }
    );
  }
}
