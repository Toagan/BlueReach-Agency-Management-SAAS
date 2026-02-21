"use client";

import { useEffect, useRef } from "react";

/**
 * Runs a callback on an interval, but only when the tab is visible.
 * Pauses when the tab is hidden, resumes when it becomes visible again.
 * Also immediately fires the callback when the tab regains focus (if enough time has passed).
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number = 30000
) {
  const callbackRef = useRef(callback);
  const lastRunRef = useRef(Date.now());

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return; // already running
      intervalId = setInterval(() => {
        callbackRef.current();
        lastRunRef.current = Date.now();
      }, intervalMs);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // If enough time has passed since last run, fire immediately
        const elapsed = Date.now() - lastRunRef.current;
        if (elapsed >= intervalMs) {
          callbackRef.current();
          lastRunRef.current = Date.now();
        }
        startPolling();
      }
    };

    // Start polling only if tab is visible
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);
}
