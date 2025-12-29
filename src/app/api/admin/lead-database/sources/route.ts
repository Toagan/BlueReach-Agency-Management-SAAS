import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: List all lead sources
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data: sources, error, count } = await supabase
      .from("lead_sources")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching sources:", error);
      throw error;
    }

    return NextResponse.json({
      sources: sources || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead sources" },
      { status: 500 }
    );
  }
}

// POST: Create a new lead source (upload batch)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      name,
      file_name,
      industry,
      region,
      sub_region,
      source_type,
      scrape_date,
      tags,
      notes,
      custom_fields,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const { data: source, error } = await supabase
      .from("lead_sources")
      .insert({
        name,
        file_name,
        industry,
        region,
        sub_region,
        source_type,
        scrape_date,
        tags: tags || [],
        notes,
        custom_fields: custom_fields || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating source:", error);
      throw error;
    }

    return NextResponse.json({ source });
  } catch (error) {
    console.error("Error creating lead source:", error);
    return NextResponse.json(
      { error: "Failed to create lead source" },
      { status: 500 }
    );
  }
}
