import { NextResponse } from "next/server";
import {
  getCampaignAnalytics,
  getCampaignOverviewAnalytics,
  getCampaignDailyAnalytics,
  getInstantlyClient,
} from "@/lib/instantly";

// GET - Get campaign analytics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const type = searchParams.get("type") || "all"; // "all", "overview", "daily"
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

    if (type === "overview") {
      const overview = await getCampaignOverviewAnalytics();
      return NextResponse.json({ overview });
    }

    if (type === "daily") {
      const daily = await getCampaignDailyAnalytics(params);
      return NextResponse.json({ daily });
    }

    // type === "all" - fetch both
    const [analytics, overview, daily] = await Promise.all([
      getCampaignAnalytics(params),
      getCampaignOverviewAnalytics(),
      getCampaignDailyAnalytics(params),
    ]);

    return NextResponse.json({
      analytics,
      overview,
      daily,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
