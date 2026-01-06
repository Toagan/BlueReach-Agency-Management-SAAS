import { createBrowserClient } from "@supabase/ssr";

// Debug: Log environment variable status
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window !== "undefined") {
  console.log("[Supabase Client Init]", {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "MISSING",
    key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : "MISSING",
  });
}

export function createClient() {
  // Validate environment variables
  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(
      `Supabase configuration missing. URL: ${supabaseUrl ? "OK" : "MISSING"}, Key: ${supabaseAnonKey ? "OK" : "MISSING"}. ` +
      `Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set at BUILD TIME in Railway.`
    );
    console.error("[Supabase Client]", error.message);

    // In development, throw to surface the issue
    // In production, we'll try to continue but auth won't work
    if (process.env.NODE_ENV === "development") {
      throw error;
    }
  }

  try {
    return createBrowserClient(
      supabaseUrl || "",
      supabaseAnonKey || ""
    );
  } catch (err) {
    console.error("[Supabase Client] Failed to create client:", err);
    throw err;
  }
}
