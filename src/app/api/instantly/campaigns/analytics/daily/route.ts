import { NextResponse } from "next/server";
import {
  getCampaignDailyAnalytics,
  getInstantlyClient,
} from "@/lib/instantly";

// GET - Get daily analytics breakdown
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const client = getInstantlyClient();
    if (!(await client.isConfiguredAsync())) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const params: { campaign_id?: string; start_date?: string; end_date?: string } = {};
    if (campaignId) params.campaign_id = campaignId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const daily = await getCampaignDailyAnalytics(params);
    return NextResponse.json({ daily });
  } catch (error) {
    console.error("Error fetching daily analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch daily analytics" },
      { status: 500 }
    );
  }
}
