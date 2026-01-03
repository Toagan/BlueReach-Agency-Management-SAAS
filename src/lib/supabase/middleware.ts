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

  // Protected routes
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Admin route protection - check user role and permissions
  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

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

  // Redirect logged-in users away from login page based on role
  if (pathname === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    if (profile?.role === "admin") {
      url.pathname = "/admin";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
