import { headers } from "next/headers";

/**
 * Returns the correct base URL for the application.
 *
 * This utility handles the complexity of determining the correct URL when:
 * - Running locally (localhost:3000)
 * - Deployed behind a proxy like Railway (needs x-forwarded-host)
 * - Environment variable is explicitly set (NEXT_PUBLIC_APP_URL)
 *
 * Priority order:
 * 1. NEXT_PUBLIC_APP_URL environment variable (if set and not empty)
 * 2. x-forwarded-host header (for proxy deployments like Railway)
 * 3. host header (standard HTTP host)
 * 4. Fallback to localhost (development only)
 */

/**
 * Server-side: Get the base URL from headers or environment
 * Use this in Route Handlers and Server Components
 */
export async function getServerUrl(): Promise<string> {
  // First priority: explicit environment variable
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  // Second priority: detect from request headers (for Railway/proxy deployments)
  try {
    const headersList = await headers();

    // x-forwarded-host is set by proxies like Railway
    const forwardedHost = headersList.get("x-forwarded-host");
    const forwardedProto = headersList.get("x-forwarded-proto") || "https";

    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    // Fallback to regular host header
    const host = headersList.get("host");
    if (host) {
      // Determine protocol - assume https in production
      const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
      const protocol = isLocalhost ? "http" : "https";
      return `${protocol}://${host}`;
    }
  } catch {
    // headers() might throw if called outside of a request context
  }

  // Last resort fallback (only for development)
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // In production without proper config, throw an error
  throw new Error(
    "Unable to determine application URL. Please set NEXT_PUBLIC_APP_URL environment variable."
  );
}

/**
 * Server-side: Synchronous version that only uses environment variable
 * Use this when headers() is not available (e.g., in middleware or edge functions)
 */
export function getServerUrlSync(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_APP_URL is required in production. Please set this environment variable."
  );
}

/**
 * Client-side: Get the base URL from window.location or runtime config
 * Use this in Client Components
 */
export function getClientUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("getClientUrl() can only be called on the client side");
  }

  // First try runtime config (set by layout.tsx for Railway)
  const runtimeConfig = (window as { __RUNTIME_CONFIG__?: { appUrl?: string } }).__RUNTIME_CONFIG__;
  if (runtimeConfig?.appUrl && runtimeConfig.appUrl.trim() !== "") {
    return runtimeConfig.appUrl.replace(/\/$/, "");
  }

  // Fallback to window.location.origin (always correct on client)
  return window.location.origin;
}

/**
 * Universal: Get the base URL based on execution context
 * Automatically detects if running on server or client
 * Note: This is async because server-side uses headers()
 */
export async function getAppUrl(): Promise<string> {
  if (typeof window !== "undefined") {
    return getClientUrl();
  }
  return getServerUrl();
}
