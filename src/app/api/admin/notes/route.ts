import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";

const NOTES_KEY = "admin_notes_content";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get notes content (scoped by owner)
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabase();
    const ownerId = await getEffectiveOwnerId(auth);

    const { data, error } = await supabase
      .from("settings")
      .select("value, updated_at")
      .eq("key", NOTES_KEY)
      .eq("owner_id", ownerId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine for new notes
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      content: data?.value || "",
      updated_at: data?.updated_at || null,
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST - Save notes content (scoped by owner)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabase();
    const ownerId = await getEffectiveOwnerId(auth);
    const body = await request.json();
    const { content } = body;

    // Check if notes setting exists for this owner
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", NOTES_KEY)
      .eq("owner_id", ownerId)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing notes
      const { error } = await supabase
        .from("settings")
        .update({
          value: content || "",
          updated_at: now,
        })
        .eq("key", NOTES_KEY)
        .eq("owner_id", ownerId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Insert new notes setting with owner_id
      const { error } = await supabase.from("settings").insert({
        key: NOTES_KEY,
        value: content || "",
        owner_id: ownerId,
        is_encrypted: false,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      updated_at: now,
    });
  } catch (error) {
    console.error("Error saving notes:", error);
    return NextResponse.json(
      { error: "Failed to save notes" },
      { status: 500 }
    );
  }
}
