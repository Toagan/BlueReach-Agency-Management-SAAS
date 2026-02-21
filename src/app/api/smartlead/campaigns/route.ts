import { NextResponse } from "next/server";
import { getSmartleadClient, fetchAllSmartleadCampaigns } from "@/lib/smartlead";
import { requireAuth } from "@/lib/auth";

// GET - List all campaigns from SmartLead
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const client = getSmartleadClient();

    const isConfigured = await client.isConfiguredAsync();
    if (!isConfigured) {
      return NextResponse.json(
        { error: "Smartlead API not configured" },
        { status: 503 }
      );
    }

    const campaigns = await fetchAllSmartleadCampaigns();

    // Convert integer IDs to strings for frontend consistency
    const normalizedCampaigns = campaigns.map((campaign) => ({
      id: String(campaign.id),
      name: campaign.name,
      status: campaign.status,
    }));

    return NextResponse.json({ campaigns: normalizedCampaigns });
  } catch (error) {
    console.error("Error fetching Smartlead campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
