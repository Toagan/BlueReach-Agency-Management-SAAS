import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchInstantlyCampaign,
  getCampaignAnalytics,
  getCampaignDailyAnalytics,
  activateCampaign,
  pauseCampaign,
  deleteInstantlyCampaign,
  getInstantlyClient,
} from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get campaign details with analytics
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const client = getInstantlyClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const [campaign, analytics, dailyAnalytics] = await Promise.all([
      fetchInstantlyCampaign(id),
      getCampaignAnalytics({ id }),
      getCampaignDailyAnalytics({ id }),
    ]);

    return NextResponse.json({
      campaign,
      analytics: analytics[0] || null,
      dailyAnalytics,
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// POST - Activate or pause campaign
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body as { action: "activate" | "pause" };

    if (!action || !["activate", "pause"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'activate' or 'pause'" },
        { status: 400 }
      );
    }

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const result = action === "activate"
      ? await activateCampaign(id)
      : await pauseCampaign(id);

    return NextResponse.json({
      ...result,
      action,
    });
  } catch (error) {
    console.error("Error updating campaign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE - Delete campaign from Instantly ONLY (does NOT touch local data)
// This is an admin-only action - UI must enforce this restriction
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    // Delete from Instantly ONLY - local campaign and leads are NOT touched
    const result = await deleteInstantlyCampaign(id);

    return NextResponse.json({
      success: true,
      instantly_deleted: result.success,
      message: "Campaign deleted from Instantly. Local data remains unchanged.",
    });
  } catch (error) {
    console.error("Error deleting campaign from Instantly:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
