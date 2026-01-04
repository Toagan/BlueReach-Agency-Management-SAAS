"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  campaignId: string;
  leadsCount?: number; // Local leads count from database
  providerLeadsCount?: number; // Leads count from provider (Instantly)
  onSyncComplete?: () => void;
}

// Calculate estimated sync time based on lead count
function estimateSyncTime(leadsCount: number): number {
  if (!leadsCount || leadsCount <= 0) return 30;
  const pages = Math.ceil(leadsCount / 100);
  const batches = Math.ceil(pages / 5); // 5 concurrent
  const apiTime = batches * 1.2; // ~1.2s per batch (including delay)
  const dbTime = leadsCount / 500; // DB insert time estimate
  return Math.ceil(apiTime + dbTime);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
}

export function SyncButton({ campaignId, leadsCount = 0, providerLeadsCount = 0, onSyncComplete }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Use provider count for estimate, fall back to local count
  const estimatedTime = estimateSyncTime(providerLeadsCount || leadsCount);

  // Check if already synced (local count is within 5% of provider count)
  const isAlreadySynced = providerLeadsCount > 0 && leadsCount > 0 &&
    Math.abs(leadsCount - providerLeadsCount) / providerLeadsCount < 0.05;

  // Timer to show elapsed time during sync
  useEffect(() => {
    if (syncing) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [syncing]);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      // Add timeout to prevent infinite waiting
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const res = await fetch(`/api/campaigns/${campaignId}/sync-leads`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (data.error) {
        setResult({ success: false, message: data.error });
        setSyncing(false);
      } else {
        setResult({
          success: true,
          message: `Synced ${data.inserted} new, ${data.updated} updated`,
        });
        setSyncing(false);
        onSyncComplete?.();
        // Refresh the page to show updated counts
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setResult({
          success: false,
          message: "Sync timed out after 5 minutes. Check server logs.",
        });
      } else {
        setResult({
          success: false,
          message: error instanceof Error ? error.message : "Sync failed",
        });
      }
      setSyncing(false);
    }
  };

  const progress = estimatedTime > 0 ? Math.min((elapsed / estimatedTime) * 100, 95) : 0;

  return (
    <div className="flex flex-col gap-2">
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
        {!syncing && !result && (
          isAlreadySynced ? (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Synced ({leadsCount.toLocaleString()} leads)
            </span>
          ) : providerLeadsCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {providerLeadsCount.toLocaleString()} leads ({formatTime(estimatedTime)})
            </span>
          ) : leadsCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {leadsCount.toLocaleString()} local leads
            </span>
          ) : null
        )}
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
      {syncing && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground min-w-[80px]">
            {elapsed}s / {formatTime(estimatedTime)}
          </span>
        </div>
      )}
    </div>
  );
}
