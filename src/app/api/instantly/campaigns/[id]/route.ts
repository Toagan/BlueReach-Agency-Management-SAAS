import { NextResponse } from "next/server";
import {
  fetchInstantlyCampaign,
  getCampaignAnalytics,
  getCampaignDailyAnalytics,
  activateCampaign,
  pauseCampaign,
  getInstantlyClient,
} from "@/lib/instantly";

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
