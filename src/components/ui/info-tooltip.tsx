"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  children: React.ReactNode;
}

export function InfoTooltip({ children }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="More information"
      >
        <Info className="h-4 w-4" />
      </button>
      {isVisible && (
        <div className="absolute left-0 top-full mt-2 z-50 min-w-[280px] max-w-[350px] p-4 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg">
          <div className="absolute -top-2 left-3 w-3 h-3 bg-popover border-l border-t border-border rotate-45" />
          {children}
        </div>
      )}
    </div>
  );
}
