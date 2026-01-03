import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Create a Supabase client with service role for admin operations
function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Send an invitation to a client
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceSupabase = getServiceSupabase();

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
    const { client_id, email, first_name } = body;

    if (!client_id || !email) {
      return NextResponse.json(
        { error: "client_id and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get client name for the invitation
    const { data: client } = await serviceSupabase
      .from("clients")
      .select("name")
      .eq("id", client_id)
      .single();

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Generate invitation token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Store invitation in database
    const { data: invitation, error: insertError } = await serviceSupabase
      .from("client_invitations")
      .insert({
        client_id,
        email: email.toLowerCase().trim(),
        first_name: first_name?.trim() || null,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Table might not exist, create it
      if (insertError.code === "42P01") {
        return NextResponse.json(
          { error: "Invitations table not set up. Please run database migration." },
          { status: 500 }
        );
      }
      console.error("Error creating invitation:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Send invitation email using Supabase Auth
    // This sends a magic link that allows the user to sign in
    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/auth/invite?token=${token}`;

    // Check if user already exists
    const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // User already exists - update their metadata with new client_id and link them
      console.log("[Invitation] User already exists, updating metadata and linking:", existingUser.id);

      // Update user metadata to point to new client
      const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(
        existingUser.id,
        {
          user_metadata: {
            ...existingUser.user_metadata,
            client_id: client_id,
            first_name: first_name || existingUser.user_metadata?.first_name || "",
            invited: true,
          },
        }
      );

      if (updateError) {
        console.error("[Invitation] Error updating user metadata:", updateError);
      }

      // Ensure profile exists
      const { data: existingProfile } = await serviceSupabase
        .from("profiles")
        .select("id")
        .eq("id", existingUser.id)
        .single();

      if (!existingProfile) {
        await serviceSupabase.from("profiles").insert({
          id: existingUser.id,
          email: existingUser.email,
          first_name: first_name || existingUser.user_metadata?.first_name || null,
          role: "client",
        });
        console.log("[Invitation] Created profile for existing user");
      }

      // Link them to the client
      const { error: linkError } = await serviceSupabase
        .from("client_users")
        .upsert({
          client_id: client_id,
          user_id: existingUser.id,
          role: "viewer",
        }, { onConflict: "client_id,user_id" });

      if (linkError) {
        console.error("[Invitation] Error linking existing user:", linkError);
      }

      // Update invitation as already accepted
      await serviceSupabase
        .from("client_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return NextResponse.json({
        success: true,
        invitation,
        invite_url: inviteUrl,
        email_sent: false,
        user_linked: true,
        message: "User already exists and has been linked to the client",
      });
    }

    // New user - send invite email
    console.log("[Invitation] Sending invite email to:", email);
    const { data: inviteData, error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${baseUrl}/auth/callback?next=/dashboard&client_id=${client_id}`,
      data: {
        first_name: first_name || "",
        client_id: client_id,
        invited: true,
      },
    });

    console.log("[Invitation] Invite result:", { inviteData, inviteError });

    if (inviteError) {
      console.error("[Invitation] Error sending invite email:", inviteError);
      return NextResponse.json({
        success: true,
        invitation,
        invite_url: inviteUrl,
        email_sent: false,
        email_error: inviteError.message,
      });
    }

    console.log("[Invitation] Email sent successfully to:", email);
    return NextResponse.json({
      success: true,
      invitation,
      invite_url: inviteUrl,
      email_sent: true,
      user_created: inviteData?.user?.id,
    });
  } catch (error) {
    console.error("Error in invitations POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - List invitations for a client
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const { data: invitations, error } = await supabase
      .from("client_invitations")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invitations:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Error in invitations GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
