import { NextResponse } from "next/server";

/**
 * Debug endpoint to check if environment variables are available
 * DELETE THIS FILE after debugging is complete!
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Mask sensitive values
  const maskValue = (value: string | undefined, showChars = 10) => {
    if (!value) return "MISSING";
    if (value.length <= showChars) return value;
    return `${value.substring(0, showChars)}...${value.substring(value.length - 4)}`;
  };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: maskValue(supabaseUrl, 25),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: maskValue(supabaseAnonKey, 15),
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? "SET (hidden)" : "MISSING",
      NEXT_PUBLIC_APP_URL: appUrl || "MISSING",
    },
    status: {
      urlOk: !!supabaseUrl,
      anonKeyOk: !!supabaseAnonKey,
      serviceKeyOk: !!supabaseServiceKey,
      allRequiredOk: !!supabaseUrl && !!supabaseAnonKey && !!supabaseServiceKey,
    },
    hint: !supabaseUrl || !supabaseAnonKey
      ? "NEXT_PUBLIC_* variables must be set at BUILD TIME in Railway. Redeploy after adding them."
      : "Environment looks good!",
  });
}
