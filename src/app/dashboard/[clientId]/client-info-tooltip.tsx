"use client";

import { useState } from "react";
import { Info, Target, Building2 } from "lucide-react";

interface ClientInfoTooltipProps {
  tam?: number | null;
  verticals?: string[] | null;
}

export function ClientInfoTooltip({ tam, verticals }: ClientInfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (!tam && (!verticals || verticals.length === 0)) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="Campaign targeting information"
      >
        <Info className="h-4 w-4" />
      </button>
      {isVisible && (
        <div className="absolute left-0 top-full mt-2 z-50 min-w-[250px] max-w-[320px] p-4 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg">
          <div className="absolute -top-2 left-3 w-3 h-3 bg-popover border-l border-t border-border rotate-45" />

          <p className="text-sm font-medium mb-3">Campaign Targeting</p>

          <div className="space-y-3">
            {tam && (
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Addressable Market</p>
                  <p className="font-medium">{tam.toLocaleString()} leads</p>
                </div>
              </div>
            )}

            {verticals && verticals.length > 0 && (
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Target Industries</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {verticals.map((vertical, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground"
                      >
                        {vertical}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
