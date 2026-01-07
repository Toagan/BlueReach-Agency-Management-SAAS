import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get stats report settings for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const supabase = await createServerClient();

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminSupabase = getSupabaseAdmin();

    // Get the stats report interval setting
    const settingKey = `client_${clientId}_stats_report_interval`;
    const { data: setting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", settingKey)
      .single();

    // Get last sent timestamp
    const lastSentKey = `client_${clientId}_stats_report_last_sent`;
    const { data: lastSentSetting } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", lastSentKey)
      .single();

    return NextResponse.json({
      interval: setting?.value || "disabled",
      lastSent: lastSentSetting?.value || null,
    });
  } catch (error) {
    console.error("Error fetching stats settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// POST - Update stats report settings for a client
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const body = await request.json();
    const { interval } = body as { interval: string };

    // Validate interval
    const validIntervals = ["disabled", "daily", "weekly", "monthly"];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminSupabase = getSupabaseAdmin();

    // Update the setting
    const settingKey = `client_${clientId}_stats_report_interval`;
    const { error } = await adminSupabase
      .from("settings")
      .upsert({
        key: settingKey,
        value: interval,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "key",
      });

    if (error) {
      console.error("Error saving stats settings:", error);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      interval,
    });
  } catch (error) {
    console.error("Error saving stats settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
