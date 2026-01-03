import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all email accounts with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client");
    const provider = searchParams.get("provider");
    const status = searchParams.get("status");
    const domain = searchParams.get("domain");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const supabase = getSupabase();

    // Build query using the view for joined data
    let query = supabase
      .from("email_accounts_with_health")
      .select("*", { count: "exact" });

    // Apply filters
    if (clientId && clientId !== "all") {
      query = query.eq("client_id", clientId);
    }

    if (provider && provider !== "all") {
      query = query.eq("provider_type", provider);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (domain) {
      query = query.eq("domain", domain);
    }

    // Apply pagination and ordering
    const { data: accounts, count, error } = await query
      .order("email", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      accounts: accounts || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching email accounts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
