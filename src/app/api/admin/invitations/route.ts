import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServerUrl } from "@/utils/get-url";
import { requireAdmin } from "@/lib/auth";

// Create a Supabase client with service role for admin operations
function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Send an invitation to a client
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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

    const baseUrl = await getServerUrl();
    const loginUrl = `${baseUrl}/login`;

    // Check if user already exists in our system (has a profile)
    // If so, link them directly and mark invitation as accepted
    const { data: existingProfile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingProfile) {
      console.log("[Invitation] User already has profile, linking directly:", existingProfile.id);

      // Link them to the client
      const { error: linkError } = await serviceSupabase
        .from("client_users")
        .upsert({
          client_id: client_id,
          user_id: existingProfile.id,
          role: "viewer",
        }, { onConflict: "client_id,user_id" });

      if (linkError) {
        console.error("[Invitation] Error linking existing user:", linkError);
      }

      // Mark invitation as accepted since user is already linked
      await serviceSupabase
        .from("client_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);
    }

    // Send branded invitation email via Resend
    // The email directs them to log in with Google/Microsoft OAuth
    // The auth callback will match their email to the pending invitation
    console.log("[Invitation] Sending invitation email to:", email);

    const { sendInvitationEmail } = await import("@/lib/email/send");
    const emailResult = await sendInvitationEmail({
      to: email,
      inviteeName: first_name || email.split("@")[0],
      clientName: client.name,
      loginUrl,
      inviterName: undefined,
    });

    if (!emailResult.success) {
      console.error("[Invitation] Error sending invitation email:", emailResult.error);
    } else {
      console.log("[Invitation] Invitation email sent successfully to:", email);
    }

    return NextResponse.json({
      success: true,
      invitation,
      email_sent: emailResult.success,
      email_error: emailResult.success ? undefined : emailResult.error,
      user_linked: !!existingProfile,
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
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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
