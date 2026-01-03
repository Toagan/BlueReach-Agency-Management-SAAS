import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { InfrastructureView } from "./infrastructure-view";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function fetchInfrastructureData(params: Record<string, string | string[] | undefined>) {
  const supabase = await createClient();
  const page = Number(params.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  // Fetch accounts
  const { data: accounts, count: totalAccounts } = await supabase
    .from("email_accounts")
    .select("*", { count: "exact" })
    .range(offset, offset + limit - 1)
    .order("email");

  // Fetch clients for dropdown
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, created_at")
    .eq("is_active", true)
    .order("name");

  // Calculate stats
  const { data: allAccounts } = await supabase
    .from("email_accounts")
    .select("status, warmup_reputation, provider_type, client_id");

  const byProvider: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let assignedCount = 0;

  (allAccounts || []).forEach((a) => {
    byProvider[a.provider_type] = (byProvider[a.provider_type] || 0) + 1;
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    if (a.client_id) assignedCount++;
  });

  const stats = {
    total_accounts: allAccounts?.length || 0,
    by_provider: byProvider,
    by_status: byStatus,
    assigned_accounts: assignedCount,
    unassigned_accounts: (allAccounts?.length || 0) - assignedCount,
    avg_warmup_reputation:
      allAccounts && allAccounts.length > 0
        ? Math.round(
            allAccounts.reduce((sum, a) => sum + (a.warmup_reputation || 0), 0) / allAccounts.length
          )
        : 0,
    domains_count: new Set(accounts?.map((a) => a.domain).filter(Boolean)).size,
    domains_checked: 0,
    domains_healthy: 0,
    domains_issues: 0,
  };

  // Fetch domain health with proper DomainSummary type
  const domains =
    accounts?.map((a) => a.domain).filter((d): d is string => Boolean(d)) || [];
  const uniqueDomains = [...new Set(domains)];

  const { data: domainHealth } = await supabase
    .from("domain_health")
    .select("*")
    .in("domain", uniqueDomains);

  // Build domain summary with proper types
  const domainSummary = (domainHealth || []).map((health) => ({
    ...health,
    account_count: accounts?.filter((a) => a.domain === health.domain).length || 0,
    client_count: 0, // Would need separate query to calculate
  }));

  // Update stats with domain health info
  stats.domains_checked = domainSummary.length;
  stats.domains_healthy = domainSummary.filter((d) => d.health_score >= 80).length;
  stats.domains_issues = domainSummary.filter((d) => d.health_score < 80).length;

  return {
    accounts: accounts || [],
    clients: clients || [],
    stats,
    domains: domainSummary,
    totalAccounts: totalAccounts || 0,
    currentPage: page,
  };
}

export default async function InfrastructurePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Try to fetch data, provide defaults if tables don't exist yet
  let data;
  try {
    data = await fetchInfrastructureData(params);
  } catch {
    // Tables may not exist yet
    data = {
      accounts: [],
      clients: [],
      stats: {
        total_accounts: 0,
        by_provider: {},
        by_status: {},
        assigned_accounts: 0,
        unassigned_accounts: 0,
        avg_warmup_reputation: 0,
        domains_count: 0,
        domains_checked: 0,
        domains_healthy: 0,
        domains_issues: 0,
      },
      domains: [],
      totalAccounts: 0,
      currentPage: 1,
    };
  }

  return (
    <Suspense fallback={<InfrastructureLoadingSkeleton />}>
      <InfrastructureView
        initialAccounts={data.accounts}
        initialClients={data.clients}
        initialStats={data.stats}
        initialDomains={data.domains}
        totalAccounts={data.totalAccounts}
        currentPage={data.currentPage}
      />
    </Suspense>
  );
}

function InfrastructureLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-4 w-40 bg-muted animate-pulse rounded mb-2" />
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-1" />
        <div className="h-4 w-80 bg-muted animate-pulse rounded" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border rounded-lg p-6">
            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
