// Smartlead Analytics API Functions

import { getSmartleadClient } from "./client";
import type { SmartleadCampaignAnalytics } from "./types";

// Get campaign analytics
export async function getSmartleadCampaignAnalytics(
  campaignId: number | string
): Promise<SmartleadCampaignAnalytics> {
  const client = getSmartleadClient();

  const response = await client.get<SmartleadCampaignAnalytics>(
    `/campaigns/${campaignId}/analytics`
  );

  return {
    sent_count: response.sent_count || 0,
    unique_sent_count: response.unique_sent_count || 0,
    open_count: response.open_count || 0,
    unique_open_count: response.unique_open_count || 0,
    click_count: response.click_count || 0,
    unique_click_count: response.unique_click_count || 0,
    reply_count: response.reply_count || 0,
    unique_reply_count: response.unique_reply_count || 0,
    bounce_count: response.bounce_count || 0,
    unsubscribe_count: response.unsubscribe_count || 0,
    total_leads: response.total_leads || 0,
  };
}
