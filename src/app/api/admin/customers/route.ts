import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all clients with campaign counts and lead stats
    const { data: clients, error } = await supabase
      .from("clients")
      .select(`
        *,
        campaigns(
          id,
          instantly_campaign_id,
          is_active
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching clients:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data to include campaign counts
    const customers = (clients || []).map((client) => {
      const campaigns = client.campaigns || [];
      return {
        id: client.id,
        name: client.name,
        logo_url: client.logo_url || null,
        is_active: true, // All clients are active by default
        created_at: client.created_at,
        campaigns_count: campaigns.length,
        total_leads: 0, // Will be populated from Instantly data if available
        total_emails_sent: 0,
        reply_rate: 0,
      };
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Error in customers GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: client }, { status: 201 });
  } catch (error) {
    console.error("Error in customers POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
