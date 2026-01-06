import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServerUrl } from "@/utils/get-url";

// Admin email(s) - these users get admin role automatically
const ADMIN_EMAILS = ["tilman@blue-reach.com"];

// Service role client for operations that bypass RLS
function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Get the correct origin for redirects (handles Railway proxy)
  const origin = await getServerUrl();
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect");
  const clientIdFromUrl = searchParams.get("client_id");
  const next = searchParams.get("next") ?? redirect ?? "/dashboard";

  console.log("[Auth Callback] Params:", { code: !!code, clientIdFromUrl, next, origin });

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log("[Auth Callback] Session exchange:", {
      success: !error,
      userId: sessionData?.user?.id,
      userMetadata: sessionData?.user?.user_metadata
    });

    if (!error && sessionData?.user) {
      const userId = sessionData.user.id;
      const userEmail = sessionData.user.email?.toLowerCase() || "";
      const userMetadata = sessionData.user.user_metadata || {};

      // Get client_id from URL or from user metadata (set during invite)
      const clientId = clientIdFromUrl || userMetadata.client_id;

      // Use service role client for admin operations (bypasses RLS)
      const serviceSupabase = getServiceSupabase();

      // Check if profile exists and get role
      const { data: existingProfile } = await serviceSupabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .single();

      let userRole = existingProfile?.role || "client";

      // ========================================
      // NEW USER REGISTRATION (No existing profile)
      // ========================================
      if (!existingProfile) {
        console.log("[Auth Callback] New user, checking access for:", userEmail);

        // Check 1: Is this an admin email?
        const isAdminEmail = ADMIN_EMAILS.includes(userEmail);

        if (isAdminEmail) {
          console.log("[Auth Callback] Admin email detected, creating admin profile");
          const { error: profileError } = await serviceSupabase.from("profiles").insert({
            id: userId,
            email: userEmail,
            first_name: userMetadata.first_name || userMetadata.name?.split(" ")[0] || null,
            role: "admin",
          });

          if (profileError) {
            console.error("[Auth Callback] Error creating admin profile:", profileError);
            return NextResponse.redirect(`${origin}/login?error=Failed to create profile`);
          }

          console.log("[Auth Callback] Created admin profile for:", userEmail);
          userRole = "admin";
        } else {
          // Check 2: Does this email have an invitation?
          const { data: invitation } = await serviceSupabase
            .from("client_invitations")
            .select("id, client_id")
            .eq("email", userEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (!invitation) {
            // NO INVITATION = ACCESS DENIED
            console.log("[Auth Callback] Access denied - no invitation for:", userEmail);

            // Sign out the user since they shouldn't have access
            await supabase.auth.signOut();

            return NextResponse.redirect(
              `${origin}/access-denied?email=${encodeURIComponent(userEmail)}`
            );
          }

          // Has invitation - create profile and link to client
          console.log("[Auth Callback] Found invitation for client:", invitation.client_id);

          const { error: profileError } = await serviceSupabase.from("profiles").insert({
            id: userId,
            email: userEmail,
            first_name: userMetadata.first_name || userMetadata.name?.split(" ")[0] || null,
            role: "client",
          });

          if (profileError) {
            console.error("[Auth Callback] Error creating client profile:", profileError);
            return NextResponse.redirect(`${origin}/login?error=Failed to create profile`);
          }

          console.log("[Auth Callback] Created client profile for:", userEmail);
          userRole = "client";

          // Link user to the client from invitation
          const { error: linkError } = await serviceSupabase
            .from("client_users")
            .upsert({
              user_id: userId,
              client_id: invitation.client_id,
              role: "viewer",
            }, { onConflict: "client_id,user_id" });

          if (linkError) {
            console.error("[Auth Callback] Error linking user to client:", linkError);
          } else {
            console.log("[Auth Callback] Linked user to client from invitation");
          }

          // Mark invitation as accepted
          await serviceSupabase
            .from("client_invitations")
            .update({ accepted_at: new Date().toISOString() })
            .eq("id", invitation.id);

          // Redirect directly to their client dashboard
          return NextResponse.redirect(`${origin}/admin/clients/${invitation.client_id}`);
        }
      }

      // ========================================
      // EXISTING USER LOGIN
      // ========================================
      console.log("[Auth Callback] Existing user, role:", userRole);

      // If client_id is provided, link the user to that client
      if (clientId) {
        console.log("[Auth Callback] Linking user to client:", clientId);

        // First check if the client exists
        const { data: clientExists } = await serviceSupabase
          .from("clients")
          .select("id")
          .eq("id", clientId)
          .single();

        if (!clientExists) {
          console.error("[Auth Callback] Client does not exist:", clientId);
          if (userRole === "admin") {
            return NextResponse.redirect(`${origin}/admin?error=Client no longer exists`);
          }
          return NextResponse.redirect(`${origin}/dashboard?error=Client no longer exists`);
        }

        // Check if user is already linked to this client
        const { data: existingLink } = await serviceSupabase
          .from("client_users")
          .select("client_id, user_id")
          .eq("user_id", userId)
          .eq("client_id", clientId)
          .single();

        // If not linked, create the link
        if (!existingLink) {
          const { error: linkError } = await serviceSupabase
            .from("client_users")
            .insert({
              user_id: userId,
              client_id: clientId,
              role: "viewer",
            });

          if (linkError) {
            console.error("[Auth Callback] Error linking user to client:", linkError);
          } else {
            console.log("[Auth Callback] Successfully linked user to client");
          }
        }

        // Redirect directly to the client page
        return NextResponse.redirect(`${origin}/admin/clients/${clientId}`);
      }

      // Role-based redirect when no specific client is provided
      if (userRole === "admin") {
        console.log("[Auth Callback] Admin user, redirecting to /admin");
        return NextResponse.redirect(`${origin}/admin`);
      }

      // For client users, check for pending invitations
      if (userEmail) {
        const { data: pendingInvitation } = await serviceSupabase
          .from("client_invitations")
          .select("id, client_id")
          .eq("email", userEmail)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (pendingInvitation) {
          console.log("[Auth Callback] Found pending invitation for client:", pendingInvitation.client_id);

          // Link user to the client from invitation
          const { error: linkError } = await serviceSupabase
            .from("client_users")
            .upsert({
              user_id: userId,
              client_id: pendingInvitation.client_id,
              role: "viewer",
            }, { onConflict: "client_id,user_id" });

          if (linkError) {
            console.error("[Auth Callback] Error linking from invitation:", linkError);
          } else {
            console.log("[Auth Callback] Linked user to client from invitation");
          }

          // Mark invitation as accepted
          await serviceSupabase
            .from("client_invitations")
            .update({ accepted_at: new Date().toISOString() })
            .eq("id", pendingInvitation.id);

          return NextResponse.redirect(`${origin}/admin/clients/${pendingInvitation.client_id}`);
        }
      }

      // Check if they have any existing linked clients
      const { data: linkedClients } = await serviceSupabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", userId);

      if (linkedClients && linkedClients.length === 1) {
        console.log("[Auth Callback] Client user with one client, redirecting to client page");
        return NextResponse.redirect(`${origin}/admin/clients/${linkedClients[0].client_id}`);
      }

      if (linkedClients && linkedClients.length > 1) {
        console.log("[Auth Callback] Client user with multiple clients, redirecting to /dashboard");
        return NextResponse.redirect(`${origin}/dashboard`);
      }

      // No linked clients - check for any invitations and link
      if (userEmail) {
        const { data: anyInvitation } = await serviceSupabase
          .from("client_invitations")
          .select("client_id")
          .eq("email", userEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (anyInvitation) {
          console.log("[Auth Callback] Found invitation for client:", anyInvitation.client_id);

          const { error: linkError } = await serviceSupabase
            .from("client_users")
            .upsert({
              user_id: userId,
              client_id: anyInvitation.client_id,
              role: "viewer",
            }, { onConflict: "client_id,user_id" });

          if (!linkError) {
            return NextResponse.redirect(`${origin}/admin/clients/${anyInvitation.client_id}`);
          }
        }
      }

      // Client user with no linked clients
      console.log("[Auth Callback] Client user with no linked clients, redirecting to /dashboard");
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Return to login with error
  console.log("[Auth Callback] Authentication failed, redirecting to login");
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}
