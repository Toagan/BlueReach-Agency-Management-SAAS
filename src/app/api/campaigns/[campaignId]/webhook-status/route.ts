import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import { InstantlyProvider } from "@/lib/providers/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// GET - Check webhook status for a campaign
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const supabase = getSupabase();

    // Get campaign details
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id, provider_campaign_id, provider_type, is_active, cached_contacted_count, cached_leads_count")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const providerCampaignId = campaign.provider_campaign_id || campaign.instantly_campaign_id;

    if (!providerCampaignId) {
      return NextResponse.json({
        configured: false,
        reason: "No provider campaign ID",
        isCompleted: false,
      });
    }

    // Check if campaign is completed (all leads contacted)
    const contactedCount = campaign.cached_contacted_count || 0;
    const leadsCount = campaign.cached_leads_count || 0;
    const isCompleted = leadsCount > 0 && contactedCount >= leadsCount * 0.99; // 99% threshold

    // If campaign is completed and not active, webhook status doesn't matter
    if (isCompleted && !campaign.is_active) {
      return NextResponse.json({
        configured: true, // Show as OK for completed campaigns
        isCompleted: true,
        reason: "Campaign completed",
      });
    }

    // Get provider and check webhook status
    try {
      const provider = await getProviderForCampaign(campaignId);

      // Only Instantly provider supports webhook checking
      if (provider instanceof InstantlyProvider) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
        const expectedUrl = `${baseUrl}/api/webhooks/instantly/${campaignId}`;

        const status = await provider.checkWebhookStatus(
          providerCampaignId,
          campaignId // Check if webhook URL contains our campaign ID
        );

        return NextResponse.json({
          configured: status.configured,
          webhookUrl: status.webhookUrl,
          eventTypes: status.eventTypes,
          expectedUrl,
          isCompleted,
          isActive: campaign.is_active,
        });
      }

      // For other providers, assume not configured
      return NextResponse.json({
        configured: false,
        reason: "Provider does not support webhook status check",
        isCompleted,
      });
    } catch (providerError) {
      console.error("Error checking webhook status:", providerError);
      return NextResponse.json({
        configured: false,
        reason: "Failed to check provider",
        error: providerError instanceof Error ? providerError.message : "Unknown error",
        isCompleted,
      });
    }
  } catch (error) {
    console.error("Error in webhook-status route:", error);
    return NextResponse.json(
      { error: "Failed to check webhook status" },
      { status: 500 }
    );
  }
}
