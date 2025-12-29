import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get all settings (values masked for security)
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: settings, error } = await supabase
      .from("settings")
      .select("key, value, is_encrypted, updated_at")
      .order("key");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mask encrypted values (only show if set or not)
    const maskedSettings = settings.map((setting) => ({
      key: setting.key,
      is_set: !!setting.value && setting.value.length > 0,
      is_encrypted: setting.is_encrypted,
      updated_at: setting.updated_at,
      // Only show last 4 chars for encrypted values
      masked_value: setting.is_encrypted && setting.value
        ? "••••••••" + setting.value.slice(-4)
        : setting.value,
    }));

    return NextResponse.json({ settings: maskedSettings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// POST - Update a setting
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    // Check if setting exists
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", key)
      .single();

    if (existing) {
      // Update existing setting
      const { error } = await supabase
        .from("settings")
        .update({
          value: value || "",
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Insert new setting
      const { error } = await supabase.from("settings").insert({
        key,
        value: value || "",
        is_encrypted: key.includes("key") || key.includes("secret"),
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "Setting updated" });
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}

// DELETE - Clear a setting value
export async function DELETE(request: Request) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("settings")
      .update({
        value: "",
        updated_at: new Date().toISOString(),
      })
      .eq("key", key);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Setting cleared" });
  } catch (error) {
    console.error("Error clearing setting:", error);
    return NextResponse.json(
      { error: "Failed to clear setting" },
      { status: 500 }
    );
  }
}
