"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Mail, ThumbsUp, RefreshCw, Clock } from "lucide-react";

interface VariantStats {
  step: number;
  variant: string;
  variantId: number | null;
  emailsSent: number;
  replies: number;
  positiveReplies: number;
  replyRate: number;
  positiveReplyRate: number;
}

interface VariantAnalyticsData {
  campaignId: string;
  campaignName: string;
  providerType: string;
  variants: VariantStats[];
  winner: {
    step: number;
    variant: string;
    metric: string;
    value: number;
  } | null;
  totals: {
    totalEmailsSent: number;
    totalReplies: number;
    totalPositiveReplies: number;
    overallReplyRate: number;
    overallPositiveRate: number;
  };
}

interface VariantAnalyticsProps {
  campaignId: string;
}

export function VariantAnalytics({ campaignId }: VariantAnalyticsProps) {
  const [data, setData] = useState<VariantAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setElapsedTime(0);

        // Start timer
        timerRef.current = setInterval(() => {
          setElapsedTime(prev => prev + 1);
        }, 1000);

        const res = await fetch(`/api/campaigns/${campaignId}/variant-analytics`);
        if (!res.ok) {
          throw new Error("Failed to fetch variant analytics");
        }
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load variant analytics");
      } finally {
        setLoading(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    fetchData();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [campaignId]);

  if (loading) {
    // Estimate ~15-20 seconds for large campaigns
    const estimatedTime = 20;
    const progress = Math.min((elapsedTime / estimatedTime) * 100, 95);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            A/B Test Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Loading variant statistics...
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                {elapsedTime}s elapsed
                {elapsedTime < estimatedTime && (
                  <span> (typically ~{estimatedTime}s for large campaigns)</span>
                )}
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Don't show error, just hide the section
  }

  // Don't render if no variant data
  if (data.variants.length === 0) {
    return null;
  }

  // Group variants by step
  const stepGroups = data.variants.reduce((acc, v) => {
    const step = v.step;
    if (!acc[step]) acc[step] = [];
    acc[step].push(v);
    return acc;
  }, {} as Record<number, VariantStats[]>);

  // Find winners for each step
  const getStepWinner = (variants: VariantStats[], metric: "replies" | "positiveReplies") => {
    const eligible = variants.filter(v => v.emailsSent >= 10);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, current) =>
      current[metric] > best[metric] ? current : best
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          A/B Test Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Winner Banner */}
        {data.winner && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-amber-700 dark:text-amber-300">Top Performer</span>
            </div>
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-bold">Step {data.winner.step} - Variant {data.winner.variant}</span>
              {" "}has the highest positive reply rate at{" "}
              <span className="font-bold">{data.winner.value}%</span>
            </p>
          </div>
        )}

        {/* Stats by Step */}
        {Object.entries(stepGroups)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([step, variants]) => {
            const stepWinnerReplies = getStepWinner(variants, "replies");
            const stepWinnerPositive = getStepWinner(variants, "positiveReplies");

            return (
              <div key={step} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 font-medium flex items-center justify-between">
                  <span>Step {step}</span>
                  <span className="text-sm text-muted-foreground">
                    {variants.length} variant{variants.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-4 font-medium text-muted-foreground">Variant</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          <div className="flex items-center justify-end gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            Sent
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Replies</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Reply %</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          <div className="flex items-center justify-end gap-1">
                            <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                            Positive
                          </div>
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Positive %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants
                        .sort((a, b) => b.positiveReplies - a.positiveReplies)
                        .map((v) => {
                          const isTopReplies = stepWinnerReplies?.variant === v.variant;
                          const isTopPositive = stepWinnerPositive?.variant === v.variant;

                          return (
                            <tr key={`${v.step}-${v.variant}`} className="border-b last:border-0">
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono">
                                    {v.variant}
                                  </Badge>
                                  {isTopPositive && v.positiveReplies > 0 && (
                                    <span title="Best positive reply rate">
                                      <Trophy className="h-4 w-4 text-amber-500" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right text-muted-foreground">
                                {v.emailsSent.toLocaleString()}
                              </td>
                              <td className="py-2 px-4 text-right">
                                <span className={isTopReplies && v.replies > 0 ? "font-semibold text-blue-600 dark:text-blue-400" : ""}>
                                  {v.replies}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-right text-muted-foreground">
                                {v.replyRate}%
                              </td>
                              <td className="py-2 px-4 text-right">
                                <span className={isTopPositive && v.positiveReplies > 0 ? "font-semibold text-green-600 dark:text-green-400" : ""}>
                                  {v.positiveReplies}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-right">
                                <span className={v.positiveReplyRate > 0 ? "font-medium text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                                  {v.positiveReplyRate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

        {/* Totals Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.totals.totalEmailsSent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Sent</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.totals.totalReplies}</p>
            <p className="text-xs text-muted-foreground">Total Replies</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-green-600">{data.totals.totalPositiveReplies}</p>
            <p className="text-xs text-muted-foreground">Positive Replies</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.totals.overallReplyRate}%</p>
            <p className="text-xs text-muted-foreground">Reply Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
