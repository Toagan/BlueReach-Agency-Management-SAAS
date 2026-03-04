import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

// GET - Get single account details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { accountId } = await params;
    const ownerId = await getEffectiveOwnerId(auth);
    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("email_accounts_with_health")
      .select("*")
      .eq("id", accountId)
      .eq("owner_id", ownerId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch account" },
      { status: 500 }
    );
  }
}

// PATCH - Update account (assign client, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { accountId } = await params;
    const body = await request.json();
    const ownerId = await getEffectiveOwnerId(auth);
    const supabase = getSupabase();

    // Verify account belongs to effective owner
    const { data: existing } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("owner_id", ownerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Only allow updating certain fields
    const allowedFields = ["client_id"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: account, error } = await supabase
      .from("email_accounts")
      .update(updates)
      .eq("id", accountId)
      .eq("owner_id", ownerId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove account from tracking
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { accountId } = await params;
    const ownerId = await getEffectiveOwnerId(auth);
    const supabase = getSupabase();

    const { error } = await supabase
      .from("email_accounts")
      .delete()
      .eq("id", accountId)
      .eq("owner_id", ownerId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}
