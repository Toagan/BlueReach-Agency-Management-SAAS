"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { RefreshCw, ArrowLeft, Flame, FlameKindling, AlertCircle } from "lucide-react";

interface Account {
  email: string;
  first_name?: string;
  last_name?: string;
  provider?: string;
  warmup_status?: string;
  daily_limit?: number;
  status?: string;
  error_message?: string;
  warmup?: {
    reputation: number;
    warmup_emails_sent: number;
    warmup_emails_received: number;
  };
}

export default function InstantlyAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/instantly/accounts");
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleWarmupToggle = async (email: string, enable: boolean) => {
    setActionLoading(email);
    try {
      const response = await fetch("/api/instantly/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: enable ? "enable_warmup" : "disable_warmup",
          emails: [email],
        }),
      });
      const data = await response.json();
      if (data.success) {
        fetchAccounts();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (account: Account) => {
    if (account.status === "error" || account.error_message) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    }
    if (account.status === "disconnected") {
      return <Badge variant="secondary">Disconnected</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  const getWarmupBadge = (account: Account) => {
    if (account.warmup_status === "enabled") {
      return (
        <Badge className="bg-orange-500 flex items-center gap-1">
          <Flame className="h-3 w-3" />
          Warming
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <FlameKindling className="h-3 w-3" />
        Off
      </Badge>
    );
  };

  const getReputationColor = (reputation: number) => {
    if (reputation >= 80) return "text-green-600";
    if (reputation >= 50) return "text-yellow-600";
    return "text-red-600";
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
          <Link
            href="/admin/instantly"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Instantly
          </Link>
          <h1 className="text-2xl font-bold mt-2">Email Accounts</h1>
          <p className="text-gray-500">{accounts.length} accounts connected</p>
        </div>
        <Button onClick={fetchAccounts} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No email accounts found in Instantly
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.email}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{account.email}</CardTitle>
                    {(account.first_name || account.last_name) && (
                      <p className="text-sm text-gray-500">
                        {account.first_name} {account.last_name}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(account)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Warmup</span>
                  {getWarmupBadge(account)}
                </div>

                {account.warmup && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Reputation</span>
                      <span className={`font-bold ${getReputationColor(account.warmup.reputation)}`}>
                        {account.warmup.reputation}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          account.warmup.reputation >= 80
                            ? "bg-green-500"
                            : account.warmup.reputation >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${account.warmup.reputation}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Sent: {account.warmup.warmup_emails_sent}</span>
                      <span>Received: {account.warmup.warmup_emails_received}</span>
                    </div>
                  </div>
                )}

                {account.daily_limit && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Daily Limit</span>
                    <span className="text-sm font-medium">{account.daily_limit}</span>
                  </div>
                )}

                {account.error_message && (
                  <p className="text-sm text-red-600">{account.error_message}</p>
                )}

                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      handleWarmupToggle(account.email, account.warmup_status !== "enabled")
                    }
                    disabled={actionLoading === account.email}
                  >
                    {actionLoading === account.email ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : account.warmup_status === "enabled" ? (
                      "Disable Warmup"
                    ) : (
                      "Enable Warmup"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
