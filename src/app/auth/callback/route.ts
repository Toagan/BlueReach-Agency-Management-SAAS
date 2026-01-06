import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServerUrl } from "@/utils/get-url";

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

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: profileError } = await serviceSupabase.from("profiles").insert({
          id: userId,
          email: sessionData.user.email,
          first_name: userMetadata.first_name || null,
          role: "client",
        });
        if (profileError) {
          console.error("[Auth Callback] Error creating profile:", profileError);
        } else {
          console.log("[Auth Callback] Created profile for user:", userId);
        }
        userRole = "client";
      }

      console.log("[Auth Callback] User role:", userRole);

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
          // Redirect based on role
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

        // Redirect directly to the client page (hip UI)
        return NextResponse.redirect(`${origin}/admin/clients/${clientId}`);
      }

      // Role-based redirect when no specific client is provided
      if (userRole === "admin") {
        console.log("[Auth Callback] Admin user, redirecting to /admin");
        return NextResponse.redirect(`${origin}/admin`);
      }

      // For client users, check for pending invitations first
      const userEmail = sessionData.user.email?.toLowerCase();
      console.log("[Auth Callback] Checking invitations for email:", userEmail);

      if (userEmail) {
        // Check for pending invitations for this email
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

          // Redirect to client page (hip UI)
          return NextResponse.redirect(`${origin}/admin/clients/${pendingInvitation.client_id}`);
        }
      }

      // Check if they have any existing linked clients
      const { data: linkedClients } = await serviceSupabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", userId);

      if (linkedClients && linkedClients.length === 1) {
        // If they have exactly one client, go directly to that client's page (hip UI)
        console.log("[Auth Callback] Client user with one client, redirecting to client page");
        return NextResponse.redirect(`${origin}/admin/clients/${linkedClients[0].client_id}`);
      }

      if (linkedClients && linkedClients.length > 1) {
        // Multiple clients, let them choose
        console.log("[Auth Callback] Client user with multiple clients, redirecting to /dashboard");
        return NextResponse.redirect(`${origin}/dashboard`);
      }

      // No linked clients - check if this email has any invitations (accepted or not)
      // and link them if found
      if (userEmail) {
        const { data: anyInvitation } = await serviceSupabase
          .from("client_invitations")
          .select("client_id")
          .eq("email", userEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (anyInvitation) {
          console.log("[Auth Callback] Found invitation (possibly accepted) for client:", anyInvitation.client_id);

          // Link user to this client
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

      // Otherwise, go to the dashboard selection page
      console.log("[Auth Callback] Client user with no linked clients, redirecting to /dashboard");
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Return to login with error
  console.log("[Auth Callback] Authentication failed, redirecting to login");
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}
