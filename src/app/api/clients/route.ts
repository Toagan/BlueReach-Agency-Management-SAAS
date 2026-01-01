import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Create a new client
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: client, error } = await supabase
      .from("clients")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create client" },
      { status: 500 }
    );
  }
}

// GET - List all clients with their campaigns
export async function GET() {
  try {
    const supabase = getSupabase();

    // Fetch all clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");

    if (clientsError) {
      return NextResponse.json(
        { error: clientsError.message },
        { status: 500 }
      );
    }

    // Fetch all campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, client_id, instantly_campaign_id, is_active")
      .order("name");

    if (campaignsError) {
      return NextResponse.json(
        { error: campaignsError.message },
        { status: 500 }
      );
    }

    // Group campaigns by client
    const campaignsByClient = new Map<string, typeof campaigns>();
    for (const campaign of campaigns || []) {
      const clientCampaigns = campaignsByClient.get(campaign.client_id) || [];
      clientCampaigns.push(campaign);
      campaignsByClient.set(campaign.client_id, clientCampaigns);
    }

    // Combine clients with their campaigns
    const clientsWithCampaigns = (clients || []).map(client => ({
      ...client,
      campaigns: campaignsByClient.get(client.id) || [],
    }));

    return NextResponse.json({ clients: clientsWithCampaigns });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
