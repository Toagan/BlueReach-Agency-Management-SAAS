import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch leads for a client with optional filters
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { searchParams } = new URL(request.url);

    const positiveOnly = searchParams.get("positive") === "true";
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const supabase = getSupabase();

    let query = supabase
      .from("leads")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (positiveOnly) {
      query = query.eq("is_positive_reply", true);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error("Error fetching leads:", error);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Error in leads fetch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
