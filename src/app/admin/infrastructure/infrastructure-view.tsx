"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Server,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Mail,
  Globe,
  Shield,
  Zap,
} from "lucide-react";
import type { EmailAccountWithHealth, DomainSummary, Client } from "@/types/database";

interface InfrastructureStats {
  total_accounts: number;
  by_provider: Record<string, number>;
  by_status: Record<string, number>;
  assigned_accounts: number;
  unassigned_accounts: number;
  avg_warmup_reputation: number;
  domains_count: number;
  domains_checked: number;
  domains_healthy: number;
  domains_issues: number;
}

interface InfrastructureViewProps {
  initialAccounts: EmailAccountWithHealth[];
  initialClients: Client[];
  initialStats: InfrastructureStats;
  initialDomains: DomainSummary[];
  totalAccounts: number;
  currentPage: number;
}

export function InfrastructureView({
  initialAccounts,
  initialClients,
  initialStats,
  initialDomains,
  totalAccounts,
  currentPage,
}: InfrastructureViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasFetched = useRef(false);

  const [accounts, setAccounts] = useState<EmailAccountWithHealth[]>(initialAccounts);
  const [clients] = useState<Client[]>(initialClients);
  const [stats, setStats] = useState<InfrastructureStats>(initialStats);
  const [domains, setDomains] = useState<DomainSummary[]>(initialDomains);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checkingDns, setCheckingDns] = useState(false);

  // Filters
  const [selectedClient, setSelectedClient] = useState(searchParams.get("client") || "all");
  const [selectedProvider, setSelectedProvider] = useState(searchParams.get("provider") || "all");
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get("status") || "all");

  // Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccountWithHealth | null>(null);
  const [assignClientId, setAssignClientId] = useState<string>("");

  // Last updated
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Update URL with filters
  const updateFilters = useCallback(
    (updates: { client?: string; provider?: string; status?: string; page?: number }) => {
      const params = new URLSearchParams();

      const newClient = updates.client !== undefined ? updates.client : selectedClient;
      const newProvider = updates.provider !== undefined ? updates.provider : selectedProvider;
      const newStatus = updates.status !== undefined ? updates.status : selectedStatus;
      const newPage = updates.page !== undefined ? updates.page : currentPage;

      if (newClient && newClient !== "all") params.set("client", newClient);
      if (newProvider && newProvider !== "all") params.set("provider", newProvider);
      if (newStatus && newStatus !== "all") params.set("status", newStatus);
      if (newPage > 1) params.set("page", String(newPage));

      const queryString = params.toString();
      router.push(`/admin/infrastructure${queryString ? `?${queryString}` : ""}`);
    },
    [selectedClient, selectedProvider, selectedStatus, currentPage, router]
  );

  // Fetch data
  const fetchData = useCallback(async (force = false) => {
    if (hasFetched.current && !force) return;
    hasFetched.current = true;
    setLoading(true);

    try {
      const [statsRes, domainsRes] = await Promise.all([
        fetch("/api/admin/infrastructure/stats"),
        fetch("/api/admin/infrastructure/dns"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (domainsRes.ok) {
        const domainsData = await domainsRes.json();
        setDomains(domainsData.domains || []);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync from providers
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/infrastructure/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: ["instantly", "smartlead"] }),
      });

      if (res.ok) {
        // Refresh page to get new data
        router.refresh();
        hasFetched.current = false;
        await fetchData(true);
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  // Check DNS health
  const handleCheckDns = async () => {
    setCheckingDns(true);
    try {
      const res = await fetch("/api/admin/infrastructure/dns", {
        method: "PATCH",
      });

      if (res.ok) {
        // Refresh domains
        const domainsRes = await fetch("/api/admin/infrastructure/dns");
        if (domainsRes.ok) {
          const data = await domainsRes.json();
          setDomains(data.domains || []);
        }
      }
    } catch (error) {
      console.error("DNS check failed:", error);
    } finally {
      setCheckingDns(false);
    }
  };

  // Assign account to client
  const handleAssignClient = async () => {
    if (!selectedAccount) return;

    try {
      const res = await fetch(`/api/admin/infrastructure/accounts/${selectedAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: assignClientId === "none" ? null : assignClientId,
        }),
      });

      if (res.ok) {
        // Update local state
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === selectedAccount.id
              ? {
                  ...a,
                  client_id: assignClientId === "none" ? null : assignClientId,
                  client_name:
                    assignClientId === "none"
                      ? null
                      : clients.find((c) => c.id === assignClientId)?.name || null,
                }
              : a
          )
        );
        setAssignDialogOpen(false);
        setSelectedAccount(null);
        setAssignClientId("");
      }
    } catch (error) {
      console.error("Failed to assign client:", error);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      hasFetched.current = false;
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
            <AlertCircle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Reputation badge helper
  const getReputationBadge = (reputation: number | null) => {
    if (reputation === null) return <span className="text-muted-foreground">-</span>;

    if (reputation >= 80) {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{reputation}%</Badge>;
    } else if (reputation >= 50) {
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{reputation}%</Badge>;
    } else {
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{reputation}%</Badge>;
    }
  };

  // DNS health badge helper
  const getDnsHealthBadge = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground">Not checked</span>;

    if (score >= 85) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <Shield className="h-3 w-3 mr-1" />
          {score}
        </Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <Shield className="h-3 w-3 mr-1" />
          {score}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          <Shield className="h-3 w-3 mr-1" />
          {score}
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{stats.total_accounts}</p>
              </div>
              <Mail className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active / Healthy</p>
                <p className="text-2xl font-bold text-green-500">
                  {stats.by_status?.active || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Reputation</p>
                <p className="text-2xl font-bold">{stats.avg_warmup_reputation}%</p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Domains</p>
                <p className="text-2xl font-bold">{stats.domains_count}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.domains_healthy} healthy / {stats.domains_issues} issues
                </p>
              </div>
              <Globe className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={selectedClient}
          onValueChange={(value) => {
            setSelectedClient(value);
            updateFilters({ client: value });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedProvider}
          onValueChange={(value) => {
            setSelectedProvider(value);
            updateFilters({ provider: value });
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            <SelectItem value="instantly">Instantly</SelectItem>
            <SelectItem value="smartlead">Smartlead</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedStatus}
          onValueChange={(value) => {
            setSelectedStatus(value);
            updateFilters({ status: value });
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="disconnected">Disconnected</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" onClick={handleCheckDns} disabled={checkingDns}>
          <Shield className={`h-4 w-4 mr-2 ${checkingDns ? "animate-spin" : ""}`} />
          {checkingDns ? "Checking..." : "Check DNS"}
        </Button>

        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Accounts"}
        </Button>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Email Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Email Accounts ({accounts.length} of {totalAccounts})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warmup</TableHead>
                <TableHead>Reputation</TableHead>
                <TableHead>DNS</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.email}</TableCell>
                  <TableCell>
                    {account.client_name || (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {account.provider_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(account.status)}</TableCell>
                  <TableCell>
                    {account.warmup_enabled ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        On
                      </Badge>
                    ) : (
                      <Badge variant="outline">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getReputationBadge(account.warmup_reputation)}</TableCell>
                  <TableCell>{getDnsHealthBadge(account.domain_health_score)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAccount(account);
                        setAssignClientId(account.client_id || "none");
                        setAssignDialogOpen(true);
                      }}
                    >
                      Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No accounts found. Click &quot;Sync Accounts&quot; to import from Instantly/Smartlead.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Domain Health Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Health ({domains.length} domains)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead>SPF</TableHead>
                <TableHead>DKIM</TableHead>
                <TableHead>DMARC</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Last Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.domain}</TableCell>
                  <TableCell>{domain.account_count}</TableCell>
                  <TableCell>
                    {domain.spf_valid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : domain.has_spf ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    {domain.dkim_valid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : domain.has_dkim ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    {domain.dmarc_valid ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {domain.dmarc_policy && (
                          <span className="text-xs text-muted-foreground">
                            ({domain.dmarc_policy})
                          </span>
                        )}
                      </div>
                    ) : domain.has_dmarc ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>{getDnsHealthBadge(domain.health_score)}</TableCell>
                  <TableCell>
                    {domain.last_checked_at ? (
                      <span className="text-sm text-muted-foreground">
                        {new Date(domain.last_checked_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {domains.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No domains checked yet. Click &quot;Check DNS&quot; to validate domain health.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Client Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Account to Client</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Assign <strong>{selectedAccount?.email}</strong> to a client:
            </p>
            <Select value={assignClientId} onValueChange={setAssignClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Client (Unassigned)</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignClient}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
