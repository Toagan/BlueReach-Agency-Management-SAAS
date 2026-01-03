import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAllInstantlyAccounts, getWarmupAnalytics, getInstantlyClient } from "@/lib/instantly";
import { fetchSmartleadAccounts, getSmartleadWarmupAnalytics, getSmartleadClient } from "@/lib/smartlead";
import type { EmailAccountProvider } from "@/types/database";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SyncStats {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

// Sync accounts from Instantly
async function syncInstantlyAccounts(supabase: ReturnType<typeof getSupabase>): Promise<SyncStats> {
  const stats: SyncStats = { added: 0, updated: 0, removed: 0, errors: [] };

  try {
    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      stats.errors.push("Instantly API not configured");
      return stats;
    }

    // Fetch accounts and warmup analytics
    const [accounts, warmupAnalytics] = await Promise.all([
      fetchAllInstantlyAccounts(),
      getWarmupAnalytics(),
    ]);

    // Create warmup map for quick lookup
    const warmupMap = new Map(warmupAnalytics.map((w) => [w.email, w]));

    // Get existing accounts
    const { data: existingAccounts } = await supabase
      .from("email_accounts")
      .select("id, email")
      .eq("provider_type", "instantly");

    const existingMap = new Map(existingAccounts?.map((a) => [a.email, a.id]) || []);
    const syncedEmails = new Set<string>();

    // Upsert each account
    for (const account of accounts) {
      try {
        syncedEmails.add(account.email);
        const warmup = warmupMap.get(account.email);

        const accountData = {
          provider_type: "instantly" as EmailAccountProvider,
          email: account.email,
          first_name: account.first_name || null,
          last_name: account.last_name || null,
          status: account.status === "active" ? "active" : account.status === "error" ? "error" : "disconnected",
          error_message: account.error_message || null,
          warmup_enabled: account.warmup_status === "enabled",
          warmup_reputation: warmup?.reputation || account.warmup_reputation || null,
          warmup_emails_sent: warmup?.warmup_emails_sent || 0,
          warmup_emails_received: warmup?.warmup_emails_received || 0,
          warmup_saved_from_spam: warmup?.warmup_emails_saved_from_spam || 0,
          daily_limit: account.daily_limit || null,
          last_synced_at: new Date().toISOString(),
        };

        const existingId = existingMap.get(account.email);

        if (existingId) {
          // Update existing
          await supabase.from("email_accounts").update(accountData).eq("id", existingId);
          stats.updated++;
        } else {
          // Insert new
          await supabase.from("email_accounts").insert(accountData);
          stats.added++;
        }
      } catch (error) {
        stats.errors.push(`Failed to sync ${account.email}: ${error}`);
      }
    }

    // Mark accounts that no longer exist (optional - could delete or mark inactive)
    // For now, we'll keep them but could add logic here

  } catch (error) {
    stats.errors.push(`Instantly sync failed: ${error}`);
  }

  return stats;
}

// Sync accounts from Smartlead
async function syncSmartleadAccounts(supabase: ReturnType<typeof getSupabase>): Promise<SyncStats> {
  const stats: SyncStats = { added: 0, updated: 0, removed: 0, errors: [] };

  try {
    const client = getSmartleadClient();
    if (!client.isConfigured()) {
      stats.errors.push("Smartlead API not configured");
      return stats;
    }

    // Fetch accounts
    const accounts = await fetchSmartleadAccounts();

    // Fetch warmup analytics in batches
    const warmupAnalytics = await getSmartleadWarmupAnalytics(accounts);
    const warmupMap = new Map(warmupAnalytics.map((w) => [w.email_account_id, w]));

    // Get existing accounts
    const { data: existingAccounts } = await supabase
      .from("email_accounts")
      .select("id, email, provider_account_id")
      .eq("provider_type", "smartlead");

    const existingMap = new Map(
      existingAccounts?.map((a) => [a.provider_account_id, { id: a.id, email: a.email }]) || []
    );
    const syncedIds = new Set<string>();

    // Upsert each account
    for (const account of accounts) {
      try {
        const accountIdStr = String(account.id);
        syncedIds.add(accountIdStr);
        const warmup = warmupMap.get(account.id);

        // Calculate reputation from warmup stats
        let reputation: number | null = null;
        if (warmup) {
          const total = warmup.total_inbox + warmup.total_spam;
          if (total > 0) {
            reputation = Math.round((warmup.total_inbox / total) * 100);
          }
        }

        const accountData = {
          provider_type: "smartlead" as EmailAccountProvider,
          provider_account_id: accountIdStr,
          email: account.email,
          first_name: account.first_name || account.from_name || null,
          last_name: account.last_name || null,
          status: "active" as const,
          warmup_enabled: account.warmup_enabled || false,
          warmup_reputation: reputation,
          warmup_emails_sent: warmup?.total_sent || 0,
          warmup_emails_received: warmup?.total_inbox || 0,
          daily_limit: account.max_email_per_day || null,
          last_synced_at: new Date().toISOString(),
        };

        const existing = existingMap.get(accountIdStr);

        if (existing) {
          // Update existing
          await supabase.from("email_accounts").update(accountData).eq("id", existing.id);
          stats.updated++;
        } else {
          // Insert new
          await supabase.from("email_accounts").insert(accountData);
          stats.added++;
        }
      } catch (error) {
        stats.errors.push(`Failed to sync ${account.email}: ${error}`);
      }
    }
  } catch (error) {
    stats.errors.push(`Smartlead sync failed: ${error}`);
  }

  return stats;
}

// POST - Trigger sync from providers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const providers: string[] = body.providers || ["instantly", "smartlead"];

    const supabase = getSupabase();
    const results: Record<string, SyncStats> = {};

    // Sync from requested providers
    if (providers.includes("instantly")) {
      results.instantly = await syncInstantlyAccounts(supabase);
    }

    if (providers.includes("smartlead")) {
      results.smartlead = await syncSmartleadAccounts(supabase);
    }

    // Calculate totals
    const totals = {
      added: Object.values(results).reduce((sum, r) => sum + r.added, 0),
      updated: Object.values(results).reduce((sum, r) => sum + r.updated, 0),
      removed: Object.values(results).reduce((sum, r) => sum + r.removed, 0),
      errors: Object.values(results).flatMap((r) => r.errors),
    };

    return NextResponse.json({
      success: totals.errors.length === 0,
      synced: results,
      totals,
    });
  } catch (error) {
    console.error("Error during sync:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
