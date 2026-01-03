import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Subscription, BillingCycle } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get a single subscription
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching subscription:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

// PUT - Update a subscription
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      url,
      username,
      password,
      cost,
      billing_cycle,
      renewal_date,
      credits_balance,
      credits_limit,
      category,
      notes,
      is_active,
    } = body;

    const supabase = getSupabase();

    const updateData: Partial<Subscription> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (url !== undefined) updateData.url = url?.trim() || null;
    if (username !== undefined) updateData.username = username?.trim() || null;
    if (password !== undefined) updateData.password = password || null;
    if (cost !== undefined) updateData.cost = parseFloat(cost) || 0;
    if (billing_cycle !== undefined) updateData.billing_cycle = billing_cycle as BillingCycle;
    if (renewal_date !== undefined) updateData.renewal_date = renewal_date || null;
    if (credits_balance !== undefined) updateData.credits_balance = parseInt(credits_balance) || 0;
    if (credits_limit !== undefined) updateData.credits_limit = parseInt(credits_limit) || 0;
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating subscription:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update subscription" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a subscription
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting subscription:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete subscription" },
      { status: 500 }
    );
  }
}
