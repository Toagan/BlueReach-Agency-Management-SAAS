import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Get the authenticated user from the request cookies.
 * Returns null if not authenticated.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<
  | { user: { id: string; email?: string }; error?: never }
  | { user?: never; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  return { user };
}

/**
 * Require admin role. Returns the user and platform admin flag, or an error response.
 */
export async function requireAdmin(): Promise<
  | { user: { id: string; email?: string }; isPlatformAdmin: boolean; error?: never }
  | { user?: never; isPlatformAdmin?: never; error: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const supabase = getServiceSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_platform_admin")
    .eq("id", auth.user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, isPlatformAdmin: profile.is_platform_admin === true };
}

/**
 * Require platform admin role. Returns 403 for regular admins.
 */
export async function requirePlatformAdmin(): Promise<
  | { user: { id: string; email?: string }; error?: never }
  | { user?: never; error: NextResponse }
> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!auth.isPlatformAdmin) {
    return {
      error: NextResponse.json(
        { error: "Platform admin access required" },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user };
}

/**
 * Require access to a specific client. Admins only see their own clients
 * unless they are platform admins. Client users must have a link in client_users table.
 */
export async function requireClientAccess(clientId: string): Promise<
  | { user: { id: string; email?: string }; isAdmin: boolean; isPlatformAdmin: boolean; error?: never }
  | { user?: never; isAdmin?: never; isPlatformAdmin?: never; error: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const supabase = getServiceSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_platform_admin")
    .eq("id", auth.user.id)
    .single();

  if (!profile) {
    return {
      error: NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      ),
    };
  }

  const isAdmin = profile.role === "admin";
  const isPlatformAdmin = profile.is_platform_admin === true;

  if (isAdmin) {
    // Platform admins can access any client
    if (!isPlatformAdmin) {
      // Regular admins: verify they own this client
      const { data: client } = await supabase
        .from("clients")
        .select("owner_id")
        .eq("id", clientId)
        .single();

      if (!client || client.owner_id !== auth.user.id) {
        return {
          error: NextResponse.json(
            { error: "Access denied to this client" },
            { status: 403 }
          ),
        };
      }
    }
  } else {
    // Client users: check client_users table
    const { data: clientAccess } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", auth.user.id)
      .eq("client_id", clientId)
      .single();

    if (!clientAccess) {
      return {
        error: NextResponse.json(
          { error: "Access denied to this client" },
          { status: 403 }
        ),
      };
    }
  }

  return { user: auth.user, isAdmin, isPlatformAdmin };
}

/**
 * Require access to a specific campaign via its client.
 */
export async function requireCampaignAccess(campaignId: string): Promise<
  | { user: { id: string; email?: string }; isAdmin: boolean; isPlatformAdmin: boolean; clientId: string; error?: never }
  | { user?: never; isAdmin?: never; isPlatformAdmin?: never; clientId?: never; error: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const supabase = getServiceSupabase();

  // Get campaign's client_id
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("client_id")
    .eq("id", campaignId)
    .single();

  if (!campaign?.client_id) {
    return {
      error: NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_platform_admin")
    .eq("id", auth.user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isPlatformAdmin = profile?.is_platform_admin === true;

  if (isAdmin) {
    if (!isPlatformAdmin) {
      // Regular admins: verify they own the campaign's client
      const { data: client } = await supabase
        .from("clients")
        .select("owner_id")
        .eq("id", campaign.client_id)
        .single();

      if (!client || client.owner_id !== auth.user.id) {
        return {
          error: NextResponse.json(
            { error: "Access denied to this campaign" },
            { status: 403 }
          ),
        };
      }
    }
  } else {
    const { data: clientAccess } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", auth.user.id)
      .eq("client_id", campaign.client_id)
      .single();

    if (!clientAccess) {
      return {
        error: NextResponse.json(
          { error: "Access denied to this campaign" },
          { status: 403 }
        ),
      };
    }
  }

  return { user: auth.user, isAdmin, isPlatformAdmin, clientId: campaign.client_id };
}

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
