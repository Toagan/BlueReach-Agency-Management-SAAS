import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// GET - Fetch campaign details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const supabase = getSupabase();

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        clients (id, name)
      `)
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// PATCH - Update campaign (name, api_key, etc.) - Safe update preserving associations
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const supabase = getSupabase();
    const body = await request.json();
    const { name, is_active, api_key } = body;

    // Build update object with only allowed fields
    // CRITICAL: Never allow updating instantly_campaign_id
    // This preserves the association with Instantly
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    // Allow updating the API key (stored as api_key_encrypted)
    if (api_key !== undefined) {
      updateData.api_key_encrypted = api_key;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Get current campaign to preserve original_name if not set
    const { data: currentCampaign } = await supabase
      .from("campaigns")
      .select("original_name, name")
      .eq("id", campaignId)
      .single();

    // If this is the first name change and original_name is not set, preserve the original
    if (name && currentCampaign && !currentCampaign.original_name) {
      updateData.original_name = currentCampaign.name;
    }

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .update(updateData)
      .eq("id", campaignId)
      .select()
      .single();

    if (error) {
      console.error("Error updating campaign:", error);
      throw error;
    }

    return NextResponse.json({
      campaign,
      message: "Campaign updated successfully",
    });
  } catch (error) {
    console.error("Error updating campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a campaign (preserves lead data)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const supabase = getSupabase();

    // First, update leads to preserve campaign name before deletion
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name, client_id, clients(name)")
      .eq("id", campaignId)
      .single();

    if (campaign) {
      // Update leads with denormalized campaign/client info before deleting
      await supabase
        .from("leads")
        .update({
          campaign_name: campaign.name,
          client_id: campaign.client_id,
          client_name: (campaign.clients as unknown as { name: string } | null)?.name || null,
        })
        .eq("campaign_id", campaignId);
    }

    // Delete the campaign (leads are preserved with denormalized data)
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign deleted. Lead data has been preserved."
    });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
