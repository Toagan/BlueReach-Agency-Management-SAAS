import { NextResponse } from "next/server";
import {
  getCampaignOverviewAnalytics,
  getInstantlyClient,
} from "@/lib/instantly";

// GET - Get campaign overview analytics
export async function GET() {
  try {
    const client = getInstantlyClient();
    if (!(await client.isConfiguredAsync())) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const overview = await getCampaignOverviewAnalytics();
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("Error fetching overview analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch overview" },
      { status: 500 }
    );
  }
}
