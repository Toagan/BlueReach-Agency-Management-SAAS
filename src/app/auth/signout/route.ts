import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerUrl } from "@/utils/get-url";

export async function POST(request: Request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  // Support custom redirect (e.g., to homepage from access-denied page)
  const formData = await request.formData().catch(() => null);
  const redirectTo = formData?.get("redirect");

  // Use getServerUrl() to get the correct origin (handles Railway proxy)
  const origin = await getServerUrl();
  const destination = typeof redirectTo === "string" && redirectTo.startsWith("/")
    ? redirectTo
    : "/login";
  return NextResponse.redirect(`${origin}${destination}`, {
    status: 302,
  });
}
