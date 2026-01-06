import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerUrl } from "@/utils/get-url";

export async function POST() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  // Use getServerUrl() to get the correct origin (handles Railway proxy)
  const origin = await getServerUrl();
  return NextResponse.redirect(`${origin}/login`, {
    status: 302,
  });
}
