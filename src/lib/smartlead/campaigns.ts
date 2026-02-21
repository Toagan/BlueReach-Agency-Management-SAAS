// Smartlead Campaigns API Functions

import { getSmartleadClient } from "./client";
import type { SmartleadCampaign } from "./types";

// Fetch campaigns with offset-based pagination
export async function fetchSmartleadCampaigns(params?: {
  limit?: number;
  offset?: number;
}): Promise<SmartleadCampaign[]> {
  const client = getSmartleadClient();

  try {
    const response = await client.get<SmartleadCampaign[]>("/campaigns", {
      limit: params?.limit || 100,
      offset: params?.offset || 0,
    });

    // Handle both array and object responses
    if (Array.isArray(response)) {
      return response;
    }

    return [];
  } catch (error) {
    console.error("Failed to fetch Smartlead campaigns:", error);
    throw error;
  }
}

// Fetch all campaigns (paginate through all)
export async function fetchAllSmartleadCampaigns(): Promise<SmartleadCampaign[]> {
  const allCampaigns: SmartleadCampaign[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const campaigns = await fetchSmartleadCampaigns({ limit, offset });
    allCampaigns.push(...campaigns);

    if (campaigns.length < limit) {
      break;
    }
    offset += limit;
  }

  return allCampaigns;
}

// Fetch a single campaign by ID
export async function fetchSmartleadCampaign(
  campaignId: number | string
): Promise<SmartleadCampaign | null> {
  const client = getSmartleadClient();

  try {
    const response = await client.get<SmartleadCampaign>(
      `/campaigns/${campaignId}`
    );
    return response;
  } catch (error) {
    console.error(`Failed to fetch Smartlead campaign ${campaignId}:`, error);
    return null;
  }
}
