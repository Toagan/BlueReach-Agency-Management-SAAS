import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Service role client for operations that bypass RLS
function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const supabase = await createClient();

    // Verify admin access
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: client, error } = await supabase
      .from("clients")
      .select(`
        *,
        campaigns(*)
      `)
      .eq("id", customerId)
      .single();

    if (error) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer: client });
  } catch (error) {
    console.error("Error in customer GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const supabase = await createClient();

    // Verify admin access
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      updates.name = body.name.trim();
    }
    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }
    if (typeof body.website === "string") {
      updates.website = body.website;
    }
    if (typeof body.notes === "string") {
      updates.notes = body.notes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: client, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", customerId)
      .select()
      .single();

    if (error) {
      console.error("Error updating client:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: client });
  } catch (error) {
    console.error("Error in customer PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const supabase = await createClient();

    // Verify admin access
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client for cleanup operations
    const serviceSupabase = getServiceSupabase();

    // Get all users linked to this client
    const { data: clientUsers } = await serviceSupabase
      .from("client_users")
      .select("user_id")
      .eq("client_id", customerId);

    // For each linked user, check if they're linked to other clients
    // If not, delete their profile (they only had access to this client)
    if (clientUsers && clientUsers.length > 0) {
      for (const clientUser of clientUsers) {
        const { data: otherLinks } = await serviceSupabase
          .from("client_users")
          .select("client_id")
          .eq("user_id", clientUser.user_id)
          .neq("client_id", customerId);

        // If user is not linked to any other client, delete their profile
        if (!otherLinks || otherLinks.length === 0) {
          // Check if this user is an admin - don't delete admin profiles
          const { data: userProfile } = await serviceSupabase
            .from("profiles")
            .select("role")
            .eq("id", clientUser.user_id)
            .single();

          if (userProfile?.role !== "admin") {
            console.log(`[Customer Delete] Deleting profile for user: ${clientUser.user_id}`);

            // Delete the profile
            await serviceSupabase
              .from("profiles")
              .delete()
              .eq("id", clientUser.user_id);

            // Delete the auth user (requires admin API)
            await serviceSupabase.auth.admin.deleteUser(clientUser.user_id);
          }
        }
      }
    }

    // Delete client invitations
    await serviceSupabase
      .from("client_invitations")
      .delete()
      .eq("client_id", customerId);

    // Delete the client (cascades to client_users, campaigns, leads via FK constraints)
    const { error } = await serviceSupabase
      .from("clients")
      .delete()
      .eq("id", customerId);

    if (error) {
      console.error("Error deleting client:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in customer DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
