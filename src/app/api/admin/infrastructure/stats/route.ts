import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // Get account statistics
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("id, provider_type, status, warmup_reputation, client_id, domain");

    if (accountsError) {
      throw accountsError;
    }

    // Get domain health statistics
    const { data: domains, error: domainsError } = await supabase
      .from("domain_health")
      .select("id, domain, health_score");

    if (domainsError) {
      throw domainsError;
    }

    // Calculate stats
    const totalAccounts = accounts?.length || 0;
    const byProvider: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let assignedAccounts = 0;
    let unassignedAccounts = 0;
    let totalReputation = 0;
    let reputationCount = 0;
    const uniqueDomains = new Set<string>();

    accounts?.forEach((account) => {
      // By provider
      byProvider[account.provider_type] = (byProvider[account.provider_type] || 0) + 1;

      // By status
      byStatus[account.status] = (byStatus[account.status] || 0) + 1;

      // Assigned vs unassigned
      if (account.client_id) {
        assignedAccounts++;
      } else {
        unassignedAccounts++;
      }

      // Average reputation
      if (account.warmup_reputation !== null) {
        totalReputation += account.warmup_reputation;
        reputationCount++;
      }

      // Unique domains
      if (account.domain) {
        uniqueDomains.add(account.domain);
      }
    });

    const avgReputation = reputationCount > 0 ? Math.round(totalReputation / reputationCount) : 0;

    // Domain health stats
    let domainsHealthy = 0;
    let domainsWithIssues = 0;

    domains?.forEach((domain) => {
      if (domain.health_score >= 70) {
        domainsHealthy++;
      } else {
        domainsWithIssues++;
      }
    });

    return NextResponse.json({
      total_accounts: totalAccounts,
      by_provider: byProvider,
      by_status: byStatus,
      assigned_accounts: assignedAccounts,
      unassigned_accounts: unassignedAccounts,
      avg_warmup_reputation: avgReputation,
      domains_count: uniqueDomains.size,
      domains_checked: domains?.length || 0,
      domains_healthy: domainsHealthy,
      domains_issues: domainsWithIssues,
    });
  } catch (error) {
    console.error("Error fetching infrastructure stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
