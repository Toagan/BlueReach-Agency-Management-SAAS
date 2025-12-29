"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { RefreshCw, Mail, Users, BarChart3, AlertCircle, CheckCircle2 } from "lucide-react";

interface InstantlyStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
}

export default function InstantlyDashboard() {
  const [status, setStatus] = useState<InstantlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSync = async (clientId: string) => {
    setSyncing(true);
    try {
      const response = await fetch("/api/instantly/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, sync_leads: true }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`Sync complete! Campaigns: ${data.campaigns.imported} imported, ${data.campaigns.updated} updated. Leads: ${data.leads?.imported || 0} imported, ${data.leads?.updated || 0} updated.`);
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Sync error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSyncing(false);
    }
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

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Full Sync</p>
                  <p className="text-sm text-gray-500">
                    Import all campaigns and leads from Instantly
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const clientId = prompt("Enter Client ID to sync campaigns to:");
                    if (clientId) handleSync(clientId);
                  }}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Start Sync"
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
