"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { RefreshCw, Mail, Users, BarChart3, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

interface InstantlyStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
}

interface Campaign {
  id: string;
  name: string;
  instantly_campaign_id: string | null;
  is_active: boolean;
}

interface Client {
  id: string;
  name: string;
  campaigns: Campaign[];
}

interface SyncProgress {
  clientId: string;
  clientName: string;
  status: "pending" | "syncing" | "done" | "error";
  result?: {
    campaigns: { imported: number; updated: number; failed: number };
    leads: { imported: number; updated: number; failed: number } | null;
  };
  error?: string;
}

export default function InstantlyDashboard() {
  const [status, setStatus] = useState<InstantlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/instantly/status");
      const data = await response.json();

      setStatus({
        configured: data.configured,
        connected: data.connected,
        error: data.error,
      });
    } catch (error) {
      setStatus({
        configured: false,
        connected: false,
        error: error instanceof Error ? error.message : "Failed to connect",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const response = await fetch("/api/clients");
      const data = await response.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchClients();
  }, []);

  const toggleClientSelection = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const toggleAllClients = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const toggleClientExpand = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const handleSync = async () => {
    if (selectedClients.size === 0) return;

    setSyncing(true);
    const clientsToSync = clients.filter(c => selectedClients.has(c.id));

    // Initialize progress
    const initialProgress: SyncProgress[] = clientsToSync.map(c => ({
      clientId: c.id,
      clientName: c.name,
      status: "pending",
    }));
    setSyncProgress(initialProgress);

    // Sync each client sequentially
    for (let i = 0; i < clientsToSync.length; i++) {
      const client = clientsToSync[i];

      // Update status to syncing
      setSyncProgress(prev => prev.map(p =>
        p.clientId === client.id ? { ...p, status: "syncing" } : p
      ));

      try {
        const response = await fetch("/api/instantly/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: client.id, sync_leads: true }),
        });
        const data = await response.json();

        if (data.success) {
          setSyncProgress(prev => prev.map(p =>
            p.clientId === client.id ? {
              ...p,
              status: "done",
              result: {
                campaigns: data.campaigns,
                leads: data.leads,
              }
            } : p
          ));
        } else {
          setSyncProgress(prev => prev.map(p =>
            p.clientId === client.id ? {
              ...p,
              status: "error",
              error: data.error,
            } : p
          ));
        }
      } catch (error) {
        setSyncProgress(prev => prev.map(p =>
          p.clientId === client.id ? {
            ...p,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          } : p
        ));
      }
    }

    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Instantly Integration</h1>
          <p className="text-gray-500">Manage your Instantly email campaigns and accounts</p>
        </div>
        <Button onClick={fetchStatus} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            API Connection
            {status?.connected ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : status?.configured ? (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Connection Error
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Configured
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <p className="text-sm text-gray-600">
              Your Instantly API is connected and ready to use.
            </p>
          ) : status?.configured ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600">
                Error: {status.error}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Add your Instantly API key to connect.
              </p>
              <code className="block bg-gray-100 p-2 rounded text-sm">
                INSTANTLY_API_KEY=your_api_key_here
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {status?.connected && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/instantly/campaigns">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Campaigns
                  </CardTitle>
                  <Mail className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">View All</div>
                  <p className="text-xs text-gray-500">Manage campaigns</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/instantly/accounts">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Email Accounts
                  </CardTitle>
                  <Users className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">View All</div>
                  <p className="text-xs text-gray-500">Manage accounts & warmup</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/instantly/analytics">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Analytics
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">View</div>
                  <p className="text-xs text-gray-500">Campaign performance</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Sync Section */}
          <Card>
            <CardHeader>
              <CardTitle>Sync from Instantly</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Select clients to sync their campaigns and leads from Instantly. This will import new campaigns and update existing leads with the latest status.
              </p>

              {loadingClients ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : clients.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No clients found. Create a client first.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {/* Select All Header */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800">
                    <Checkbox
                      checked={selectedClients.size === clients.length && clients.length > 0}
                      onCheckedChange={toggleAllClients}
                    />
                    <span className="font-medium text-sm">
                      Select All ({clients.length} clients)
                    </span>
                  </div>

                  {/* Client List */}
                  {clients.map(client => (
                    <div key={client.id} className="divide-y">
                      <div className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                        <button
                          onClick={() => toggleClientExpand(client.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          {expandedClients.has(client.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium">{client.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {client.campaigns.length} campaigns
                          </Badge>
                        </button>

                        {/* Show sync progress for this client */}
                        {syncProgress.find(p => p.clientId === client.id) && (
                          <div className="flex items-center gap-2">
                            {syncProgress.find(p => p.clientId === client.id)?.status === "pending" && (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                            {syncProgress.find(p => p.clientId === client.id)?.status === "syncing" && (
                              <Badge className="bg-blue-500">
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Syncing
                              </Badge>
                            )}
                            {syncProgress.find(p => p.clientId === client.id)?.status === "done" && (
                              <Badge className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Done
                              </Badge>
                            )}
                            {syncProgress.find(p => p.clientId === client.id)?.status === "error" && (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expanded Campaign List */}
                      {expandedClients.has(client.id) && client.campaigns.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 px-10 py-2">
                          <ul className="space-y-1 text-sm">
                            {client.campaigns.map(campaign => (
                              <li key={campaign.id} className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span>{campaign.name}</span>
                                {campaign.is_active && (
                                  <Badge variant="outline" className="text-xs">Active</Badge>
                                )}
                                {campaign.instantly_campaign_id && (
                                  <Badge variant="secondary" className="text-xs">Linked</Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Show sync results if done */}
                      {syncProgress.find(p => p.clientId === client.id)?.status === "done" && (
                        <div className="bg-green-50 dark:bg-green-900/20 px-10 py-2 text-sm">
                          {(() => {
                            const result = syncProgress.find(p => p.clientId === client.id)?.result;
                            if (!result) return null;
                            return (
                              <div className="space-y-1">
                                <p>
                                  Campaigns: {result.campaigns.imported} imported, {result.campaigns.updated} updated
                                  {result.campaigns.failed > 0 && `, ${result.campaigns.failed} failed`}
                                </p>
                                {result.leads && (
                                  <p>
                                    Leads: {result.leads.imported} imported, {result.leads.updated} updated
                                    {result.leads.failed > 0 && `, ${result.leads.failed} failed`}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Show error if failed */}
                      {syncProgress.find(p => p.clientId === client.id)?.status === "error" && (
                        <div className="bg-red-50 dark:bg-red-900/20 px-10 py-2 text-sm text-red-600">
                          {syncProgress.find(p => p.clientId === client.id)?.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing || selectedClients.size === 0}
                  size="lg"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing {selectedClients.size} client{selectedClients.size !== 1 ? "s" : ""}...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync {selectedClients.size > 0 ? `${selectedClients.size} client${selectedClients.size !== 1 ? "s" : ""}` : "Selected"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
