// Smartlead Accounts API Functions

import { getSmartleadClient } from "./client";
import type { SmartleadAccount, SmartleadWarmupStats } from "./types";

// Response types for Smartlead API
interface AccountsListResponse {
  data?: SmartleadAccount[];
  // Smartlead may return array directly
}

interface WarmupStatsResponse {
  total_sent?: number;
  total_inbox?: number;
  total_spam?: number;
  warmup_reputation?: number;
  daily_stats?: Array<{
    date: string;
    sent: number;
    inbox: number;
    spam: number;
  }>;
}

// Fetch all email accounts
export async function fetchSmartleadAccounts(): Promise<SmartleadAccount[]> {
  const client = getSmartleadClient();

  try {
    // Smartlead API: GET /email-accounts
    const response = await client.get<SmartleadAccount[] | AccountsListResponse>(
      "/email-accounts"
    );

    // Handle both array and object responses
    if (Array.isArray(response)) {
      return response;
    }

    return response.data || [];
  } catch (error) {
    console.error("Failed to fetch Smartlead accounts:", error);
    throw error;
  }
}

// Fetch a single email account
export async function fetchSmartleadAccount(
  accountId: number | string
): Promise<SmartleadAccount | null> {
  const client = getSmartleadClient();

  try {
    const response = await client.get<SmartleadAccount>(`/email-accounts/${accountId}`);
    return response;
  } catch (error) {
    console.error(`Failed to fetch Smartlead account ${accountId}:`, error);
    return null;
  }
}

// Get warmup statistics for an account (last 7 days)
export async function getSmartleadWarmupStats(
  accountId: number | string
): Promise<SmartleadWarmupStats | null> {
  const client = getSmartleadClient();

  try {
    // Smartlead API: GET /email-accounts/{id}/warmup-stats
    const response = await client.get<WarmupStatsResponse>(
      `/email-accounts/${accountId}/warmup-stats`
    );

    return {
      email_account_id: typeof accountId === "number" ? accountId : parseInt(accountId),
      total_sent: response.total_sent || 0,
      total_inbox: response.total_inbox || 0,
      total_spam: response.total_spam || 0,
      warmup_reputation: response.warmup_reputation || 0,
      daily_stats: response.daily_stats || [],
    };
  } catch (error) {
    console.error(`Failed to fetch Smartlead warmup stats for ${accountId}:`, error);
    return null;
  }
}

// Get warmup stats for multiple accounts
export async function getSmartleadWarmupAnalytics(
  accounts: SmartleadAccount[]
): Promise<SmartleadWarmupStats[]> {
  const results: SmartleadWarmupStats[] = [];

  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (account) => {
        const stats = await getSmartleadWarmupStats(account.id);
        if (stats) {
          stats.email = account.email;
        }
        return stats;
      })
    );

    results.push(...batchResults.filter((s): s is SmartleadWarmupStats => s !== null));

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < accounts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

// Enable warmup for an account
export async function enableSmartleadWarmup(
  accountId: number | string,
  options?: {
    total_warmup_per_day?: number;
    daily_rampup?: number;
    reply_rate_percentage?: number;
  }
): Promise<boolean> {
  const client = getSmartleadClient();

  try {
    await client.post(`/email-accounts/${accountId}/warmup`, {
      warmup_enabled: true,
      total_warmup_per_day: options?.total_warmup_per_day || 35,
      daily_rampup: options?.daily_rampup || 3,
      reply_rate_percentage: options?.reply_rate_percentage || 38,
    });
    return true;
  } catch (error) {
    console.error(`Failed to enable Smartlead warmup for ${accountId}:`, error);
    return false;
  }
}

// Disable warmup for an account
export async function disableSmartleadWarmup(accountId: number | string): Promise<boolean> {
  const client = getSmartleadClient();

  try {
    await client.post(`/email-accounts/${accountId}/warmup`, {
      warmup_enabled: false,
    });
    return true;
  } catch (error) {
    console.error(`Failed to disable Smartlead warmup for ${accountId}:`, error);
    return false;
  }
}

// Get all accounts with their warmup stats (combined call)
export async function fetchSmartleadAccountsWithWarmup(): Promise<
  Array<SmartleadAccount & { warmup_stats?: SmartleadWarmupStats }>
> {
  const accounts = await fetchSmartleadAccounts();
  const warmupStats = await getSmartleadWarmupAnalytics(accounts);

  // Merge stats with accounts
  return accounts.map((account) => {
    const stats = warmupStats.find((s) => s.email_account_id === account.id);
    return {
      ...account,
      warmup_stats: stats,
    };
  });
}
