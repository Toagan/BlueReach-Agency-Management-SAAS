"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImpersonationBannerProps {
  ownerName: string;
  ownerEmail: string;
}

export function ImpersonationBanner({ ownerName, ownerEmail }: ImpersonationBannerProps) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  const handleStop = async () => {
    setStopping(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      router.push("/admin/settings");
      router.refresh();
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      setStopping(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
      <p className="text-sm text-amber-300">
        Viewing as: <strong>{ownerName || ownerEmail}</strong> ({ownerEmail}) ·{" "}
        <button
          onClick={handleStop}
          disabled={stopping}
          className="underline hover:text-amber-200 font-medium"
        >
          {stopping ? "Stopping..." : "Stop Viewing"}
        </button>
      </p>
    </div>
  );
}
