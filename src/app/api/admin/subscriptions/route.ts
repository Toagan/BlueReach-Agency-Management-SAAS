import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Subscription, BillingCycle } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all subscriptions
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// POST - Create a new subscription
export async function POST(request: Request) {
  try {
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
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Subscription name is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const insertData: Partial<Subscription> = {
      name: name.trim(),
      url: url?.trim() || null,
      username: username?.trim() || null,
      password: password || null,
      cost: parseFloat(cost) || 0,
      billing_cycle: (billing_cycle as BillingCycle) || "monthly",
      renewal_date: renewal_date || null,
      credits_balance: parseInt(credits_balance) || 0,
      credits_limit: parseInt(credits_limit) || 0,
      category: category?.trim() || null,
      notes: notes?.trim() || null,
      is_active: true,
    };

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating subscription:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subscription" },
      { status: 500 }
    );
  }
}
