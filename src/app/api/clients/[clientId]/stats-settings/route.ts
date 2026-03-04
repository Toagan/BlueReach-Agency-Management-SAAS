import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClientAccess, getClientOwnerId } from "@/lib/auth";

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
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const adminSupabase = getSupabaseAdmin();
    const ownerId = await getClientOwnerId(clientId);

    // Get the stats report interval setting
    const settingKey = `client_${clientId}_stats_report_interval`;
    let intervalQuery = adminSupabase
      .from("settings")
      .select("value")
      .eq("key", settingKey);
    if (ownerId) intervalQuery = intervalQuery.eq("owner_id", ownerId);
    const { data: setting } = await intervalQuery.single();

    // Get last sent timestamp
    const lastSentKey = `client_${clientId}_stats_report_last_sent`;
    let lastSentQuery = adminSupabase
      .from("settings")
      .select("value")
      .eq("key", lastSentKey);
    if (ownerId) lastSentQuery = lastSentQuery.eq("owner_id", ownerId);
    const { data: lastSentSetting } = await lastSentQuery.single();

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
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { interval } = body as { interval: string };

    // Validate interval
    const validIntervals = ["disabled", "daily", "weekly", "monthly"];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdmin();
    const ownerId = await getClientOwnerId(clientId);

    // Update the setting
    const settingKey = `client_${clientId}_stats_report_interval`;
    const { error } = await adminSupabase
      .from("settings")
      .upsert({
        key: settingKey,
        value: interval,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "key,owner_id",
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
