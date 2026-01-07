// Instantly Analytics API Functions

import { getInstantlyClient } from "./client";
import { getWarmupAnalytics } from "./accounts";
import type {
  InstantlyCampaignAnalytics,
  InstantlyCampaignDailyAnalytics,
  InstantlyAccountWarmupAnalytics,
} from "./types";

interface AnalyticsOverviewResponse {
  total_leads: number;
  total_contacted: number;
  total_emails_sent: number;
  total_emails_opened: number;
  total_emails_replied: number;
  total_emails_bounced: number;
  overall_open_rate: number;
  overall_reply_rate: number;
  overall_bounce_rate: number;
}

interface CampaignAnalyticsResponse {
  data: InstantlyCampaignAnalytics[];
}

// API returns { daily: [...] } wrapper or direct array
type DailyAnalyticsResponse = { daily: InstantlyCampaignDailyAnalytics[] } | InstantlyCampaignDailyAnalytics[];

export async function getOverviewAnalytics(): Promise<AnalyticsOverviewResponse> {
  const client = getInstantlyClient();
  return client.get<AnalyticsOverviewResponse>("/campaigns/analytics/overview");
}

export async function getCampaignsAnalytics(params?: {
  campaign_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<InstantlyCampaignAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.get<CampaignAnalyticsResponse>("/campaigns/analytics", params);
  return response.data || [];
}

export async function getDailyAnalytics(params?: {
  campaign_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<InstantlyCampaignDailyAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.get<DailyAnalyticsResponse>("/campaigns/analytics/daily", params);
  // API returns { daily: [...] } wrapper or direct array
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object' && 'daily' in response) {
    return response.daily || [];
  }
  return [];
}

// Combined analytics for dashboard
export interface DashboardAnalytics {
  overview: AnalyticsOverviewResponse;
  campaigns: InstantlyCampaignAnalytics[];
  warmup: InstantlyAccountWarmupAnalytics[];
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const [overview, campaigns, warmup] = await Promise.all([
    getOverviewAnalytics(),
    getCampaignsAnalytics(),
    getWarmupAnalytics(),
  ]);

  return {
    overview,
    campaigns,
    warmup,
  };
}
