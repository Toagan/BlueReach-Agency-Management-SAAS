import { createBrowserClient } from "@supabase/ssr";

// Type for runtime config injected by layout.tsx
declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      supabaseUrl: string;
      supabaseAnonKey: string;
      appUrl: string;
    };
  }
}

// Get config from build-time env vars OR runtime config (for Railway)
function getSupabaseConfig() {
  // First try build-time env vars
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If not available (Railway build issue), try runtime config
  if (typeof window !== "undefined" && (!url || !key)) {
    const runtimeConfig = window.__RUNTIME_CONFIG__;
    if (runtimeConfig) {
      url = url || runtimeConfig.supabaseUrl;
      key = key || runtimeConfig.supabaseAnonKey;
      console.log("[Supabase Client] Using runtime config from server");
    }
  }

  return { url, key };
}

export function createClient() {
  const { url, key } = getSupabaseConfig();

  // Debug logging
  if (typeof window !== "undefined") {
    console.log("[Supabase Client Init]", {
      url: url ? `${url.substring(0, 25)}...` : "MISSING",
      key: key ? `${key.substring(0, 15)}...` : "MISSING",
      source: process.env.NEXT_PUBLIC_SUPABASE_URL ? "build-time" : "runtime",
    });
  }

  // Validate configuration
  if (!url || !key) {
    const error = new Error(
      `Supabase configuration missing. URL: ${url ? "OK" : "MISSING"}, Key: ${key ? "OK" : "MISSING"}. ` +
      `Check Railway environment variables.`
    );
    console.error("[Supabase Client]", error.message);
    throw error;
  }

  try {
    return createBrowserClient(url, key);
  } catch (err) {
    console.error("[Supabase Client] Failed to create client:", err);
    throw err;
  }
}
