import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";
import { getUserSubscription, isSuperAdmin } from "@/lib/stripe/helpers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Create a new client
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const ownerId = await getEffectiveOwnerId(auth);

    // Enforce subscription client limit (skip for super admins)
    if (!isSuperAdmin(auth.user.email)) {
      const subscription = await getUserSubscription(ownerId);
      if (subscription?.client_limit) {
        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ownerId);

        if ((count || 0) >= subscription.client_limit) {
          return NextResponse.json(
            { error: `Client limit reached (${subscription.client_limit} max for your plan). Please upgrade to add more clients.` },
            { status: 403 }
          );
        }
      }
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({ name: name.trim(), owner_id: ownerId })
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

// GET - List all clients with their campaigns (scoped by owner)
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const supabase = getSupabase();

    const ownerId = await getEffectiveOwnerId(auth);

    // Fetch clients scoped by effective owner (always scoped)
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("owner_id", ownerId)
      .order("name");

    if (clientsError) {
      return NextResponse.json(
        { error: clientsError.message },
        { status: 500 }
      );
    }

    const clientIds = (clients || []).map(c => c.id);

    // Fetch campaigns only for visible clients
    let campaigns: typeof campaignsData = [];
    let campaignsData: Array<{ id: string; name: string; client_id: string; instantly_campaign_id: string | null; is_active: boolean }> = [];

    if (clientIds.length > 0) {
      const { data, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, name, client_id, instantly_campaign_id, is_active")
        .in("client_id", clientIds)
        .order("name");

      if (campaignsError) {
        return NextResponse.json(
          { error: campaignsError.message },
          { status: 500 }
        );
      }
      campaignsData = data || [];
    }

    // Group campaigns by client
    const campaignsByClient = new Map<string, typeof campaignsData>();
    for (const campaign of campaignsData) {
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
