import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't need any checks
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/access-denied" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/webhooks/");

  if (isPublicRoute) {
    // For login page, redirect logged-in users with profiles to their dashboard
    if (pathname === "/login" && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // Only redirect if they have a profile (authorized user)
      if (profile) {
        const url = request.nextUrl.clone();
        if (profile.role === "admin") {
          url.pathname = "/admin";
        } else {
          url.pathname = "/dashboard";
        }
        return NextResponse.redirect(url);
      }
    }
    return supabaseResponse;
  }

  // Protected routes
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // For authenticated users on protected routes, verify they have a profile
  if (user && isProtectedRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // If user has a session but NO profile, they bypassed the callback or were never invited
    if (!profile) {
      console.log("[Middleware] User has session but no profile, access denied:", user.email);
      const url = request.nextUrl.clone();
      url.pathname = "/access-denied";
      url.searchParams.set("email", user.email || "");
      return NextResponse.redirect(url);
    }

    const isAdmin = profile.role === "admin";

    // Admin route protection
    if (pathname.startsWith("/admin")) {
      // Check if this is a client-specific route that client users can access
      const clientRouteMatch = pathname.match(/^\/admin\/clients\/([a-f0-9-]+)/);

      if (!isAdmin) {
        if (clientRouteMatch) {
          // Client user trying to access a client page - verify they have access
          const clientId = clientRouteMatch[1];
          const { data: clientAccess } = await supabase
            .from("client_users")
            .select("client_id")
            .eq("user_id", user.id)
            .eq("client_id", clientId)
            .single();

          if (!clientAccess) {
            console.log("[Middleware] Client user blocked - no access to client:", clientId);
            const url = request.nextUrl.clone();
            url.pathname = "/dashboard";
            url.searchParams.set("error", "Access denied to this client");
            return NextResponse.redirect(url);
          }
          // Client user has access to this specific client - allow
          console.log("[Middleware] Client user allowed access to client:", clientId);
        } else {
          // Non-admin trying to access other admin routes - block
          console.log("[Middleware] Non-admin user blocked from admin route:", pathname);
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          url.searchParams.set("error", "Access denied");
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
