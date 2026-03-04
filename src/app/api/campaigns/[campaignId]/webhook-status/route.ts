import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import { InstantlyProvider } from "@/lib/providers/instantly";
import { requireCampaignAccess } from "@/lib/auth";

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
    const auth = await requireCampaignAccess(campaignId);
    if (auth.error) return auth.error;
    const supabase = getSupabase();

    // Get campaign details
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id, provider_campaign_id, provider_type, is_active, cached_contacted_count, cached_leads_count, webhook_configured")
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

    // If webhook_configured is manually set to true, trust that
    const providerType = campaign.provider_type || "instantly";
    if (campaign.webhook_configured === true) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
      return NextResponse.json({
        configured: true,
        reason: "Manually confirmed",
        expectedUrl: `${baseUrl}/api/webhooks/${providerType}/${campaignId}`,
        isCompleted,
        isActive: campaign.is_active,
      });
    }

    // Get provider and check webhook status
    try {
      const provider = await getProviderForCampaign(campaignId);

      // Only Instantly provider supports webhook checking
      if (provider instanceof InstantlyProvider) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
        const expectedCampaignUrl = `${baseUrl}/api/webhooks/instantly/${campaignId}`;
        const expectedGenericUrl = `${baseUrl}/api/webhooks/instantly`;

        // First check for campaign-specific webhook URL
        let status = await provider.checkWebhookStatus(
          providerCampaignId,
          campaignId // Check if webhook URL contains our campaign ID
        );

        // If not found, also check for generic webhook URL (both are valid)
        if (!status.configured) {
          const genericStatus = await provider.checkWebhookStatus(
            providerCampaignId,
            "/api/webhooks/instantly" // Check for generic endpoint
          );
          // Only accept generic URL if it doesn't have a different campaign ID
          if (genericStatus.configured && genericStatus.webhookUrl) {
            // Make sure it's the generic endpoint, not another campaign's specific endpoint
            const url = genericStatus.webhookUrl;
            if (url.endsWith("/api/webhooks/instantly") || url.includes("/api/webhooks/instantly?")) {
              status = genericStatus;
            }
          }
        }

        return NextResponse.json({
          configured: status.configured,
          webhookUrl: status.webhookUrl,
          eventTypes: status.eventTypes,
          expectedUrl: expectedCampaignUrl,
          alternativeUrl: expectedGenericUrl,
          isCompleted,
          isActive: campaign.is_active,
        });
      }

      // For Smartlead and other providers, check webhook_logs for recent activity
      const { count } = await supabase
        .from("webhook_logs")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bluereach-agency-management-saas-production.up.railway.app";
      return NextResponse.json({
        configured: (count || 0) > 0 || campaign.webhook_configured === true,
        reason: (count || 0) > 0 ? "Webhook events received" : "No webhook events yet - configure in provider",
        expectedUrl: `${baseUrl}/api/webhooks/${providerType}/${campaignId}`,
        webhookEvents: count || 0,
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
