// Instantly Accounts API Functions

import { getInstantlyClient } from "./client";
import type {
  InstantlyAccount,
  InstantlyAccountWarmupAnalytics,
  InstantlyAccountDailyAnalytics,
} from "./types";

interface AccountsListResponse {
  items: InstantlyAccount[];
}

interface WarmupAnalyticsResponse {
  data: InstantlyAccountWarmupAnalytics[];
}

interface DailyAnalyticsResponse {
  data: InstantlyAccountDailyAnalytics[];
}

export async function fetchInstantlyAccounts(params?: {
  limit?: number;
  skip?: number;
  status?: string;
}): Promise<InstantlyAccount[]> {
  const client = getInstantlyClient();
  const response = await client.get<AccountsListResponse>("/accounts", {
    limit: params?.limit || 100,
    skip: params?.skip || 0,
    status: params?.status,
  });
  return response.items || [];
}

export async function fetchAllInstantlyAccounts(): Promise<InstantlyAccount[]> {
  const allAccounts: InstantlyAccount[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const accounts = await fetchInstantlyAccounts({ limit, skip });
    allAccounts.push(...accounts);

    if (accounts.length < limit) {
      break;
    }
    skip += limit;
  }

  return allAccounts;
}

export async function fetchInstantlyAccount(email: string): Promise<InstantlyAccount> {
  const client = getInstantlyClient();
  return client.get<InstantlyAccount>(`/accounts/${encodeURIComponent(email)}`);
}

export async function enableWarmup(emails: string[]): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>("/accounts/warmup/enable", { emails });
}

export async function disableWarmup(emails: string[]): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>("/accounts/warmup/disable", { emails });
}

export async function getWarmupAnalytics(emails?: string[]): Promise<InstantlyAccountWarmupAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.post<WarmupAnalyticsResponse>("/accounts/warmup-analytics", {
    emails: emails || [],
  });
  return response.data || [];
}

export async function getAccountDailyAnalytics(params?: {
  email?: string;
  start_date?: string;
  end_date?: string;
}): Promise<InstantlyAccountDailyAnalytics[]> {
  const client = getInstantlyClient();
  const response = await client.get<DailyAnalyticsResponse>("/accounts/analytics/daily", params);
  return response.data || [];
}

export async function testAccountVitals(emails: string[]): Promise<{
  results: Array<{
    email: string;
    status: string;
    error?: string;
  }>;
}> {
  const client = getInstantlyClient();
  return client.post<{
    results: Array<{
      email: string;
      status: string;
      error?: string;
    }>;
  }>("/accounts/test/vitals", { emails });
}
