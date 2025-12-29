"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  TrendingUp,
  Zap,
  RefreshCw,
  Plus,
  ExternalLink,
  Activity,
  BarChart3,
  Users,
  Eye,
  MousePointer,
  ThumbsUp,
  Trash2,
} from "lucide-react";

interface CampaignAnalytics {
  emails_sent: number;
  emails_opened: number;
  emails_replied: number;
  emails_bounced: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
  total_opportunities: number;
  leads_count: number;
  contacted_count: number;
}

interface Campaign {
  id: string;
  name: string;
  instantly_campaign_id: string | null;
  is_active: boolean;
  status?: string;
  analytics?: CampaignAnalytics | null;
}

interface ClientData {
  id: string;
  name: string;
  is_active: boolean;
  website?: string;
  notes?: string;
  created_at: string;
}

interface ClientStats {
  totalEmailsSent: number;
  totalOpened: number;
  totalReplies: number;
  totalBounced: number;
  totalPositiveReplies: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  activeCampaigns: number;
  totalCampaigns: number;
}

export default function ClientDashboardPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const hasFetched = useRef(false);

  const [client, setClient] = useState<ClientData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    totalEmailsSent: 0,
    totalOpened: 0,
    totalReplies: 0,
    totalBounced: 0,
    totalPositiveReplies: 0,
    openRate: 0,
    replyRate: 0,
    bounceRate: 0,
    activeCampaigns: 0,
    totalCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Are you sure you want to unlink "${campaignName}"?\n\nThis will remove the campaign from this dashboard. Leads will be preserved.`)) {
      return;
    }

    setDeletingCampaignId(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete campaign");
      }

      // Refresh the data
      fetchClientData(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign");
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const fetchClientData = useCallback(async (force = false) => {
    if (hasFetched.current && !force) return;
    hasFetched.current = true;
    setLoading(true);
    setError(null);

    try {
      // Fetch client details and campaigns in parallel
      const [clientRes, campaignsRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/campaigns`),
      ]);

      if (!clientRes.ok) {
        throw new Error("Client not found");
      }

      const clientData = await clientRes.json();
      const campaignsData = await campaignsRes.json();

      setClient(clientData.client);
      setCampaigns(campaignsData.campaigns || []);

      // Calculate stats from linked campaigns
      let totalEmailsSent = 0;
      let totalOpened = 0;
      let totalReplies = 0;
      let totalBounced = 0;
      let totalPositiveReplies = 0;
      let activeCampaigns = 0;

      (campaignsData.campaigns || []).forEach((campaign: Campaign) => {
        if (campaign.is_active) {
          activeCampaigns++;
        }
        if (campaign.analytics) {
          totalEmailsSent += campaign.analytics.emails_sent || 0;
          totalOpened += campaign.analytics.emails_opened || 0;
          totalReplies += campaign.analytics.emails_replied || 0;
          totalBounced += campaign.analytics.emails_bounced || 0;
          totalPositiveReplies += campaign.analytics.total_opportunities || 0;
        }
      });

      const openRate = totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0;
      const replyRate = totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0;
      const bounceRate = totalEmailsSent > 0 ? (totalBounced / totalEmailsSent) * 100 : 0;

      setStats({
        totalEmailsSent,
        totalOpened,
        totalReplies,
        totalBounced,
        totalPositiveReplies,
        openRate,
        replyRate,
        bounceRate,
        activeCampaigns,
        totalCampaigns: (campaignsData.campaigns || []).length,
      });

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClientData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchClientData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchClientData]);

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Center
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-600">
                {client?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{client?.name}</h1>
              <p className="text-slate-500 text-sm">Campaign Performance Dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchClientData(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Emails Sent</span>
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.totalEmailsSent.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Open Rate</span>
              <Eye className="h-5 w-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.openRate.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-400">{stats.totalOpened.toLocaleString()} opens</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Reply Rate</span>
              <MessageSquare className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.replyRate.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-400">{stats.totalReplies.toLocaleString()} replies</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Positive Replies</span>
              <ThumbsUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalPositiveReplies.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Active Campaigns</span>
              <Zap className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats.activeCampaigns}</div>
            <p className="text-xs text-slate-400">of {stats.totalCampaigns} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign Performance
          </CardTitle>
          <Link href={`/admin/clients/${clientId}/campaigns`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Link Campaign
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No campaigns linked yet</p>
              <p className="text-sm mt-1">
                Link an Instantly campaign to start tracking performance.
              </p>
              <Link href={`/admin/clients/${clientId}/campaigns`}>
                <Button className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Link Your First Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  clientId={clientId}
                  onDelete={() => handleDeleteCampaign(campaign.id, campaign.name)}
                  isDeleting={deletingCampaignId === campaign.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  clientId,
  onDelete,
  isDeleting,
}: {
  campaign: Campaign;
  clientId: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const analytics = campaign.analytics;
  const hasAnalytics = analytics && analytics.emails_sent > 0;

  return (
    <div className="border rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/admin/clients/${clientId}/campaigns/${campaign.id}`}
              className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
            >
              {campaign.name}
            </Link>
            <Badge
              variant={campaign.is_active ? "default" : "secondary"}
              className={campaign.is_active ? "bg-green-100 text-green-700" : ""}
            >
              {campaign.is_active ? "Active" : "Paused"}
            </Badge>
          </div>

          {hasAnalytics ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Sent</p>
                <p className="text-lg font-semibold text-slate-900">
                  {analytics.emails_sent.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Opens</p>
                <p className="text-lg font-semibold text-slate-900">
                  {analytics.emails_opened.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-1">
                    ({(analytics.open_rate * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Replies</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {analytics.emails_replied.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-1">
                    ({(analytics.reply_rate * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Positive</p>
                <p className="text-lg font-semibold text-green-600">
                  {(analytics.total_opportunities || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Bounced</p>
                <p className="text-lg font-semibold text-slate-900">
                  {analytics.emails_bounced.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-1">
                    ({(analytics.bounce_rate * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-2">No analytics data available yet</p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="text-slate-400 hover:text-red-500 disabled:opacity-50"
          title="Unlink campaign"
        >
          {isDeleting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Progress bar: leads contacted vs total leads */}
      {hasAnalytics && analytics.leads_count > 0 && (() => {
        const leadsContacted = Math.min(analytics.contacted_count, analytics.leads_count);
        const progressPct = (leadsContacted / analytics.leads_count) * 100;
        return (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Campaign Progress</span>
              <span>
                {leadsContacted.toLocaleString()} / {analytics.leads_count.toLocaleString()} leads contacted
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
