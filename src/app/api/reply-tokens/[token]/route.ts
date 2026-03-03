import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const TTL_MS = 72 * 3600 * 1000; // 72 hours

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("reply_tokens")
    .select("id, lead_email, subject, body, created_at, used_at")
    .eq("id", token)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Reply link not found or expired" },
      { status: 404 }
    );
  }

  // Check TTL
  const createdAt = new Date(data.created_at).getTime();
  if (Date.now() - createdAt > TTL_MS) {
    return NextResponse.json(
      { error: "Reply link has expired" },
      { status: 404 }
    );
  }

  // Track first access
  if (!data.used_at) {
    supabase
      .from("reply_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", token)
      .then(() => {});
  }

  return NextResponse.json(
    {
      leadEmail: data.lead_email,
      subject: data.subject,
      body: data.body,
    },
    {
      headers: {
        "Referrer-Policy": "no-referrer",
      },
    }
  );
}
