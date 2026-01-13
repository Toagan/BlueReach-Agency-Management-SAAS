import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

// GET - Fetch tool links for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { clientId } = await params;
    const supabase = getSupabase();

    // Fetch tool links from settings
    const keys = [
      `client_${clientId}_goal_text`,
      `client_${clientId}_clay_url`,
      `client_${clientId}_outbound_url`,
    ];

    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", keys);

    const settingsMap = new Map(settings?.map((s) => [s.key, s.value]) || []);

    return NextResponse.json({
      goalText: settingsMap.get(`client_${clientId}_goal_text`) || "",
      clayUrl: settingsMap.get(`client_${clientId}_clay_url`) || "",
      outboundUrl: settingsMap.get(`client_${clientId}_outbound_url`) || "",
    });
  } catch (error) {
    console.error("Error fetching tool links:", error);
    return NextResponse.json(
      { error: "Failed to fetch tool links" },
      { status: 500 }
    );
  }
}

// POST - Save tool links for a client
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { clientId } = await params;
    const body = await request.json();
    const { goalText, clayUrl, outboundUrl } = body;

    const supabase = getSupabase();

    // Upsert each setting
    const settings = [
      { key: `client_${clientId}_goal_text`, value: goalText || "" },
      { key: `client_${clientId}_clay_url`, value: clayUrl || "" },
      { key: `client_${clientId}_outbound_url`, value: outboundUrl || "" },
    ];

    for (const setting of settings) {
      await supabase
        .from("settings")
        .upsert(setting, { onConflict: "key" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving tool links:", error);
    return NextResponse.json(
      { error: "Failed to save tool links" },
      { status: 500 }
    );
  }
}
