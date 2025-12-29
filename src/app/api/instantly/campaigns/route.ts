import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllInstantlyCampaigns,
  getCampaignAnalytics,
  getInstantlyClient,
} from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all campaigns from Instantly
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAnalytics = searchParams.get("analytics") === "true";

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const campaigns = await fetchAllInstantlyCampaigns();

    // Only fetch analytics if requested (slower)
    if (includeAnalytics) {
      const analytics = await getCampaignAnalytics();
      const analyticsMap = new Map(analytics.map(a => [a.campaign_id, a]));
      const campaignsWithAnalytics = campaigns.map(campaign => ({
        ...campaign,
        analytics: analyticsMap.get(campaign.id) || null,
      }));
      return NextResponse.json({ campaigns: campaignsWithAnalytics });
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error fetching Instantly campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST - Sync campaigns from Instantly to local DB
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client_id, campaign_ids } = body as {
      client_id: string;
      campaign_ids?: string[];
    };

    if (!client_id) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch campaigns from Instantly
    const instantlyCampaigns = await fetchAllInstantlyCampaigns();

    // Filter if specific campaign_ids provided
    const campaignsToSync = campaign_ids
      ? instantlyCampaigns.filter(c => campaign_ids.includes(c.id))
      : instantlyCampaigns;

    // Get existing campaigns to avoid duplicates
    const { data: existingCampaigns } = await supabase
      .from("campaigns")
      .select("instantly_campaign_id")
      .not("instantly_campaign_id", "is", null);

    const existingIds = new Set(existingCampaigns?.map(c => c.instantly_campaign_id) || []);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const campaign of campaignsToSync) {
      if (existingIds.has(campaign.id)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("campaigns").insert({
        client_id,
        instantly_campaign_id: campaign.id,
        name: campaign.name,
        is_active: campaign.status === "active",
      });

      if (error) {
        errors.push(`Failed to import ${campaign.name}: ${error.message}`);
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error syncing campaigns:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync campaigns" },
      { status: 500 }
    );
  }
}
