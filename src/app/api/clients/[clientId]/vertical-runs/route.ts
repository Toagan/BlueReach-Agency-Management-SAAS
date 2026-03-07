import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClientAccess } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List vertical runs for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const auth = await requireClientAccess(clientId);
  if (auth.error) return auth.error;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vertical_runs")
    .select("*")
    .eq("client_id", clientId)
    .order("date_started", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vertical_runs: data });
}

// POST - Create a new vertical run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const auth = await requireClientAccess(clientId);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { vertical, date_started, geography, lead_count, notes } = body;

  if (!vertical || !date_started) {
    return NextResponse.json(
      { error: "vertical and date_started are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vertical_runs")
    .insert({
      client_id: clientId,
      vertical,
      date_started,
      geography: geography || null,
      lead_count: lead_count ? parseInt(lead_count, 10) : null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vertical_run: data });
}

// DELETE - Delete a vertical run
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("id");

  if (!runId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("vertical_runs")
    .delete()
    .eq("id", runId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
