import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClientAccess, getClientOwnerId } from "@/lib/auth";

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
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;
    const supabase = getSupabase();
    const ownerId = await getClientOwnerId(clientId);

    // Fetch tool links from settings
    const keys = [
      `client_${clientId}_goal_text`,
      `client_${clientId}_clay_url`,
      `client_${clientId}_outbound_url`,
    ];

    let query = supabase
      .from("settings")
      .select("key, value")
      .in("key", keys);

    if (ownerId) query = query.eq("owner_id", ownerId);

    const { data: settings } = await query;

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
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { goalText, clayUrl, outboundUrl } = body;

    const supabase = getSupabase();
    const ownerId = await getClientOwnerId(clientId);

    // Upsert each setting
    const settings = [
      { key: `client_${clientId}_goal_text`, value: goalText || "" },
      { key: `client_${clientId}_clay_url`, value: clayUrl || "" },
      { key: `client_${clientId}_outbound_url`, value: outboundUrl || "" },
    ];

    for (const setting of settings) {
      await supabase
        .from("settings")
        .upsert({ ...setting, owner_id: ownerId }, { onConflict: "key,owner_id" });
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
