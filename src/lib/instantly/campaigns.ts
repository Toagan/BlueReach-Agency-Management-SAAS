// Instantly Campaigns API Functions

import { getInstantlyClient } from "./client";
import type {
  InstantlyCampaign,
  InstantlyCampaignAnalytics,
  InstantlyCampaignDailyAnalytics,
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
