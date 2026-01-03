"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  campaignId: string;
  onSyncComplete?: () => void;
}

export function SyncButton({ campaignId, onSyncComplete }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sync-leads`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.error) {
        setResult({ success: false, message: data.error });
      } else {
        setResult({
          success: true,
          message: `Synced ${data.inserted} new, ${data.updated} updated`,
        });
        onSyncComplete?.();
        // Refresh the page to show updated counts
        window.location.reload();
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Sync failed",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <>
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync Leads
          </>
        )}
      </Button>
      {result && (
        <span
          className={`text-xs flex items-center gap-1 ${
            result.success ? "text-green-600" : "text-red-600"
          }`}
        >
          {result.success ? (
            <Check className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          {result.message}
        </span>
      )}
    </div>
  );
}
