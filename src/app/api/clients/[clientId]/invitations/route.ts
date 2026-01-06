import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email";
import { getServerUrl } from "@/utils/get-url";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List invited users for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const supabase = await createServerClient();

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get all client users with their profile info
    const adminSupabase = getSupabaseAdmin();

    const { data: clientUsers, error } = await adminSupabase
      .from("client_users")
      .select(`
        user_id,
        role,
        created_at,
        profiles:user_id (
          id,
          email,
          full_name
        )
      `)
      .eq("client_id", clientId);

    if (error) {
      console.error("Error fetching client users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get pending invitations
    const { data: invitations } = await adminSupabase
      .from("client_invitations")
      .select("*")
      .eq("client_id", clientId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    return NextResponse.json({
      users: clientUsers || [],
      pendingInvitations: invitations || [],
    });
  } catch (error) {
    console.error("Error in GET /api/clients/[clientId]/invitations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST - Invite a user to a client
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await request.json();
    const { email, name, role = "owner" } = body as { email: string; name?: string; role?: string };

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get inviter's display name for the email
    const inviterName = profile?.full_name || profile?.email?.split("@")[0] || "Your account manager";

    const adminSupabase = getSupabaseAdmin();

    // Get client info
    const { data: client } = await adminSupabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if user already exists
    const { data: existingProfile } = await adminSupabase
      .from("profiles")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (existingProfile) {
      // Check if user is already linked to this client
      const { data: existingLink } = await adminSupabase
        .from("client_users")
        .select("user_id")
        .eq("client_id", clientId)
        .eq("user_id", existingProfile.id)
        .single();

      if (existingLink) {
        return NextResponse.json(
          { error: "User is already a member of this client" },
          { status: 400 }
        );
      }

      // Link existing user to client
      const { error: linkError } = await adminSupabase
        .from("client_users")
        .insert({
          client_id: clientId,
          user_id: existingProfile.id,
          role: role,
        });

      if (linkError) {
        console.error("Error linking user:", linkError);
        return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
      }

      // Generate a login link for the existing user to access their new client
      const appUrl = await getServerUrl();
      const dashboardUrl = `${appUrl}/dashboard/${clientId}`;
      const loginUrl = `${appUrl}/login?redirect=${encodeURIComponent(`/dashboard/${clientId}`)}`;

      // Send invitation email to existing user
      const emailResult = await sendInvitationEmail({
        to: email.toLowerCase(),
        inviteeName: name || email.split("@")[0],
        inviterName,
        clientName: client.name,
        loginUrl,
      });

      return NextResponse.json({
        success: true,
        message: emailResult.success
          ? `Invitation email sent to ${email}. They have been added to ${client.name}.`
          : `${email} has been added to this client. Share the link so they can access their new dashboard.`,
        isNewUser: false,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        loginUrl,
        dashboardUrl,
      });
    }

    // Check for existing pending (non-expired) invitation
    const { data: existingPendingInvitation } = await adminSupabase
      .from("client_invitations")
      .select("id")
      .eq("client_id", clientId)
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingPendingInvitation) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 400 }
      );
    }

    // Delete any expired or accepted invitations to allow re-inviting
    await adminSupabase
      .from("client_invitations")
      .delete()
      .eq("client_id", clientId)
      .eq("email", email.toLowerCase())
      .or(`expires_at.lt.${new Date().toISOString()},accepted_at.not.is.null`);

    // Create invitation token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Store invitation (table has: id, client_id, email, first_name, token, invited_by, expires_at, accepted_at)
    const { error: inviteError } = await adminSupabase
      .from("client_invitations")
      .insert({
        client_id: clientId,
        email: email.toLowerCase(),
        first_name: name || null,
        token: token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      // Table might not exist, try to create a simpler flow
      if (inviteError.code === "42P01") {
        return NextResponse.json(
          { error: "Invitations table not set up. Please run database migrations." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }

    // Generate the login URL for this invitation
    const appUrl = await getServerUrl();
    const loginUrl = `${appUrl}/login?invite=${token}&email=${encodeURIComponent(email)}`;

    // Try to send the invitation email
    const emailResult = await sendInvitationEmail({
      to: email.toLowerCase(),
      inviteeName: name || email.split("@")[0],
      inviterName,
      clientName: client.name,
      loginUrl,
    });

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? `Invitation email sent to ${email}.`
        : `Invitation created for ${email}. Share the login link with them.`,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      loginUrl,
      isNewUser: true,
    });
  } catch (error) {
    console.error("Error in POST /api/clients/[clientId]/invitations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send invitation" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a user or cancel an invitation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const invitationId = searchParams.get("invitationId");

    const supabase = await createServerClient();

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminSupabase = getSupabaseAdmin();

    if (userId) {
      // Remove user from client
      const { error } = await adminSupabase
        .from("client_users")
        .delete()
        .eq("client_id", clientId)
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "User removed" });
    }

    if (invitationId) {
      // Cancel invitation
      const { error } = await adminSupabase
        .from("client_invitations")
        .delete()
        .eq("id", invitationId)
        .eq("client_id", clientId);

      if (error) {
        return NextResponse.json({ error: "Failed to cancel invitation" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Invitation cancelled" });
    }

    return NextResponse.json({ error: "userId or invitationId required" }, { status: 400 });
  } catch (error) {
    console.error("Error in DELETE /api/clients/[clientId]/invitations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove" },
      { status: 500 }
    );
  }
}
