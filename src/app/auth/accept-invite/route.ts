import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const code = searchParams.get("code");

  // If there's an auth code, exchange it first
  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
    }
  }

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=Invalid invitation`);
  }

  const adminSupabase = getSupabaseAdmin();
  const supabase = await createServerClient();

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // User needs to complete auth first, redirect to login with token
    return NextResponse.redirect(`${origin}/login?invite=${token}`);
  }

  // Find the invitation
  const { data: invitation, error: inviteError } = await adminSupabase
    .from("client_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (inviteError || !invitation) {
    return NextResponse.redirect(`${origin}/dashboard?error=Invalid or expired invitation`);
  }

  // Check if invitation has expired
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/dashboard?error=Invitation has expired`);
  }

  // Check if user email matches invitation
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.redirect(
      `${origin}/dashboard?error=This invitation was sent to a different email address`
    );
  }

  // Ensure profile exists
  const { data: existingProfile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingProfile) {
    // Create profile
    await adminSupabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      role: "client",
    });
  }

  // Link user to client
  const { error: linkError } = await adminSupabase
    .from("client_users")
    .upsert({
      client_id: invitation.client_id,
      user_id: user.id,
      role: invitation.role || "owner",
    }, {
      onConflict: "client_id,user_id",
    });

  if (linkError) {
    console.error("Error linking user to client:", linkError);
    return NextResponse.redirect(`${origin}/dashboard?error=Failed to accept invitation`);
  }

  // Mark invitation as accepted
  await adminSupabase
    .from("client_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  // Redirect to the client dashboard
  return NextResponse.redirect(`${origin}/dashboard/${invitation.client_id}`);
}
