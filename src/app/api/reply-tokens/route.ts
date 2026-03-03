import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { leadEmail, subject, body, leadId } = await request.json();

    if (!leadEmail || !subject || !body) {
      return NextResponse.json(
        { error: "leadEmail, subject, and body are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: token, error } = await supabase
      .from("reply_tokens")
      .insert({
        lead_email: leadEmail,
        subject,
        body,
        lead_id: leadId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ReplyTokens] Failed to create token:", error);
      return NextResponse.json(
        { error: "Failed to create reply token" },
        { status: 500 }
      );
    }

    // Piggyback cleanup: delete expired tokens (>72h old)
    supabase
      .from("reply_tokens")
      .delete()
      .lt("created_at", new Date(Date.now() - 72 * 3600 * 1000).toISOString())
      .then(({ error: cleanupError }) => {
        if (cleanupError) {
          console.error("[ReplyTokens] Cleanup error:", cleanupError);
        }
      });

    return NextResponse.json({ token: token.id });
  } catch (err) {
    console.error("[ReplyTokens] Error:", err);
    return NextResponse.json(
      { error: "Failed to create reply token" },
      { status: 500 }
    );
  }
}
