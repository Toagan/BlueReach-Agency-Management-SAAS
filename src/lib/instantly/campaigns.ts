// Instantly Campaigns API Functions

import { getInstantlyClient } from "./client";
import type {
  InstantlyCampaign,
  InstantlyCampaignDetails,
  InstantlyCampaignAnalytics,
  InstantlyCampaignDailyAnalytics,
  InstantlyCampaignCreatePayload,
} from "./types";

interface CampaignsListResponse {
  items: InstantlyCampaign[];
}

// Analytics responses are direct arrays in V2 API
type CampaignAnalyticsResponse = InstantlyCampaignAnalytics[];

type CampaignDailyAnalyticsResponse = { daily: InstantlyCampaignDailyAnalytics[] } | InstantlyCampaignDailyAnalytics[];

export async function fetchInstantlyCampaigns(params?: {
  limit?: number;
  skip?: number;
  status?: string;
}): Promise<InstantlyCampaign[]> {
  const client = getInstantlyClient();
  const response = await client.get<CampaignsListResponse>("/campaigns", {
    limit: params?.limit || 100,
    skip: params?.skip || 0,
    status: params?.status,
  });
  return response.items || [];
}

export async function fetchAllInstantlyCampaigns(): Promise<InstantlyCampaign[]> {
  const allCampaigns: InstantlyCampaign[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const campaigns = await fetchInstantlyCampaigns({ limit, skip });
    allCampaigns.push(...campaigns);

    if (campaigns.length < limit) {
      break;
    }
    skip += limit;
  }

  return allCampaigns;
}

export async function fetchInstantlyCampaign(campaignId: string): Promise<InstantlyCampaign> {
  const client = getInstantlyClient();
  return client.get<InstantlyCampaign>(`/campaigns/${campaignId}`);
}

// Fetch campaign with full details including sequences (email templates)
export async function fetchInstantlyCampaignDetails(campaignId: string): Promise<InstantlyCampaignDetails> {
  const client = getInstantlyClient();
  return client.get<InstantlyCampaignDetails>(`/campaigns/${campaignId}`);
}

export async function activateCampaign(campaignId: string): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>(`/campaigns/${campaignId}/activate`);
}

export async function pauseCampaign(campaignId: string): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>(`/campaigns/${campaignId}/pause`);
}

export async function getCampaignAnalytics(params?: {
  id?: string;        // V2 API uses 'id' not 'campaign_id'
  start_date?: string;
  end_date?: string;
}): Promise<InstantlyCampaignAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.get<CampaignAnalyticsResponse>("/campaigns/analytics", params);
  // V2 API returns array directly
  return Array.isArray(response) ? response : [];
}

export async function getCampaignOverviewAnalytics(): Promise<InstantlyCampaignAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.get<CampaignAnalyticsResponse>("/campaigns/analytics/overview");
  // V2 API returns array directly
  return Array.isArray(response) ? response : [];
}

export async function getCampaignDailyAnalytics(params?: {
  id?: string;        // V2 API uses 'id' not 'campaign_id'
  start_date?: string;
  end_date?: string;
}): Promise<InstantlyCampaignDailyAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.get<CampaignDailyAnalyticsResponse>("/campaigns/analytics/daily", params);
  // API returns { daily: [...] } wrapper or direct array
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object' && 'daily' in response) {
    return response.daily || [];
  }
  return [];
}

// Create a new campaign in Instantly
export async function createInstantlyCampaign(
  payload: InstantlyCampaignCreatePayload
): Promise<InstantlyCampaign> {
  const client = getInstantlyClient();
  return client.post<InstantlyCampaign>("/campaigns", payload);
}

// Create campaign with sensible defaults
export async function createInstantlyCampaignWithDefaults(
  name: string,
  options?: {
    timezone?: string;
    emailAccounts?: string[];
    dailyLimit?: number;
    stopOnReply?: boolean;
  }
): Promise<InstantlyCampaign> {
  const payload: InstantlyCampaignCreatePayload = {
    name,
    campaign_schedule: {
      schedules: [
        {
          name: "Default Schedule",
          timing: {
            from: "09:00",
            to: "17:00",
          },
          days: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
          },
          timezone: options?.timezone || "Europe/Berlin",
        },
      ],
    },
    daily_limit: options?.dailyLimit,
    stop_on_reply: options?.stopOnReply ?? true,
    email_list: options?.emailAccounts,
  };

  return createInstantlyCampaign(payload);
}

// Delete a campaign from Instantly
export async function deleteInstantlyCampaign(
  campaignId: string
): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.delete<{ success: boolean }>(`/campaigns/${campaignId}`);
}
