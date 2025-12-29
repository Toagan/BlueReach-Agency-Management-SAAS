"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RefreshCw, ArrowLeft, Mail, Eye, Reply, AlertTriangle } from "lucide-react";

interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  total_leads: number;
  contacted: number;
  emails_sent: number;
  emails_opened: number;
  emails_replied: number;
  emails_bounced: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

interface OverviewStats {
  totalCampaigns: number;
  totalEmailsSent: number;
  totalOpens: number;
  totalReplies: number;
  totalBounces: number;
  avgOpenRate: number;
  avgReplyRate: number;
}

export default function InstantlyAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CampaignAnalytics[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/instantly/campaigns?analytics=true");
      const data = await response.json();

      const campaigns = data.campaigns || [];
      const analyticsData: CampaignAnalytics[] = campaigns
        .filter((c: { analytics?: CampaignAnalytics }) => c.analytics)
        .map((c: { analytics: CampaignAnalytics }) => c.analytics);

      setAnalytics(analyticsData);

      // Calculate overview
      const totalEmailsSent = analyticsData.reduce((sum, a) => sum + a.emails_sent, 0);
      const totalOpens = analyticsData.reduce((sum, a) => sum + a.emails_opened, 0);
      const totalReplies = analyticsData.reduce((sum, a) => sum + a.emails_replied, 0);
      const totalBounces = analyticsData.reduce((sum, a) => sum + a.emails_bounced, 0);

      setOverview({
        totalCampaigns: campaigns.length,
        totalEmailsSent,
        totalOpens,
        totalReplies,
        totalBounces,
        avgOpenRate: totalEmailsSent > 0 ? (totalOpens / totalEmailsSent) * 100 : 0,
        avgReplyRate: totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

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
          <h1 className="text-2xl font-bold mt-2">Campaign Analytics</h1>
          <p className="text-gray-500">Performance overview across all campaigns</p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalEmailsSent.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Open Rate</CardTitle>
              <Eye className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.avgOpenRate.toFixed(1)}%</div>
              <p className="text-xs text-gray-500">{overview.totalOpens.toLocaleString()} opens</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Reply Rate</CardTitle>
              <Reply className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.avgReplyRate.toFixed(1)}%</div>
              <p className="text-xs text-gray-500">{overview.totalReplies.toLocaleString()} replies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Bounces</CardTitle>
              <AlertTriangle className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalBounces.toLocaleString()}</div>
              <p className="text-xs text-gray-500">
                {overview.totalEmailsSent > 0
                  ? ((overview.totalBounces / overview.totalEmailsSent) * 100).toFixed(1)
                  : 0}% bounce rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaign Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No analytics data available</p>
          ) : (
            <div className="space-y-4">
              {analytics.map((campaign) => (
                <div key={campaign.campaign_id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium">{campaign.campaign_name}</h3>
                    <span className="text-sm text-gray-500">
                      {campaign.total_leads} leads
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Sent</p>
                      <p className="font-medium">{campaign.emails_sent}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Open Rate</p>
                      <p className="font-medium">
                        {(campaign.open_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Reply Rate</p>
                      <p className="font-medium">
                        {(campaign.reply_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Bounce Rate</p>
                      <p className="font-medium">
                        {(campaign.bounce_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {/* Simple bar chart */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16">Opens</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${campaign.open_rate * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16">Replies</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${campaign.reply_rate * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
