import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllInstantlyCampaigns,
  getCampaignAnalytics,
  getInstantlyClient,
  createInstantlyCampaignWithDefaults,
} from "@/lib/instantly";
import type { InstantlyCampaignCreatePayload } from "@/lib/instantly";

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

// PUT - Create a new campaign in Instantly and optionally link to local client
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      client_id,
      timezone,
      email_accounts,
      daily_limit,
      stop_on_reply,
      auto_link = true, // Automatically create local campaign record
    } = body as {
      name: string;
      client_id?: string;
      timezone?: string;
      email_accounts?: string[];
      daily_limit?: number;
      stop_on_reply?: boolean;
      auto_link?: boolean;
    };

    if (!name) {
      return NextResponse.json(
        { error: "Campaign name is required" },
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

    // Create campaign in Instantly
    const instantlyCampaign = await createInstantlyCampaignWithDefaults(name, {
      timezone,
      emailAccounts: email_accounts,
      dailyLimit: daily_limit,
      stopOnReply: stop_on_reply,
    });

    // Optionally create local campaign record
    let localCampaign = null;
    if (auto_link && client_id) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          client_id,
          instantly_campaign_id: instantlyCampaign.id,
          name: instantlyCampaign.name,
          is_active: false, // New campaigns start paused
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create local campaign record:", error);
      } else {
        localCampaign = data;
      }
    }

    return NextResponse.json({
      success: true,
      instantly_campaign: instantlyCampaign,
      local_campaign: localCampaign,
      webhook_url: localCampaign
        ? `/api/webhooks/instantly/${localCampaign.id}`
        : null,
    });
  } catch (error) {
    console.error("Error creating campaign in Instantly:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create campaign" },
      { status: 500 }
    );
  }
}
