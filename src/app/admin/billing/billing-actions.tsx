"use client";

import { useState } from "react";

export default function BillingActions({ isPastDue }: { isPastDue: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleManageBilling() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={handleManageBilling}
        disabled={loading}
        className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
          isPastDue
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
        }`}
      >
        {loading
          ? "Loading..."
          : isPastDue
            ? "Update Payment Method"
            : "Manage Billing"}
      </button>
    </div>
  );
}
