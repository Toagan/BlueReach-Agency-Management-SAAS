"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Users,
  RefreshCw,
  ExternalLink,
  ThumbsUp,
  AlertCircle,
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

interface CampaignData {
  id: string;
  name: string;
  instantly_campaign_id: string | null;
  is_active: boolean;
  created_at: string;
  client_id: string;
}

interface ClientData {
  id: string;
  name: string;
}

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  status: string;
  is_positive_reply: boolean;
  created_at: string;
  updated_at: string;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const campaignId = params.campaignId as string;

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch campaign details
      const [campaignRes, clientRes, leadsRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/details`),
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/campaigns/${campaignId}/leads`),
      ]);

      if (!campaignRes.ok) {
        throw new Error("Campaign not found");
      }

      const campaignData = await campaignRes.json();
      const clientData = await clientRes.json();
      const leadsData = await leadsRes.json();

      setCampaign(campaignData.campaign);
      setAnalytics(campaignData.analytics);
      setClient(clientData.client);
      setLeads(leadsData.leads || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [campaignId, clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {client?.name || "Client"}
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  // contacted_count can exceed leads_count because it includes follow-up emails
  // Use the minimum of contacted vs leads for a sensible progress percentage
  const leadsContacted = analytics
    ? Math.min(analytics.contacted_count, analytics.leads_count)
    : 0;
  const progress = analytics && analytics.leads_count > 0
    ? (leadsContacted / analytics.leads_count) * 100
    : 0;

  // Group leads by status
  const positiveLeads = leads.filter(l => l.is_positive_reply);
  const repliedLeads = leads.filter(l => l.status === 'replied' && !l.is_positive_reply);
  const recentLeads = leads.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href={`/admin/clients/${clientId}`}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {client?.name || "Client"}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{campaign?.name}</h1>
            <Badge
              variant={campaign?.is_active ? "default" : "secondary"}
              className={campaign?.is_active ? "bg-green-100 text-green-700" : ""}
            >
              {campaign?.is_active ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="text-slate-500 text-sm mt-1">Campaign Details</p>
        </div>
        <div className="flex items-center gap-2">
          {campaign?.instantly_campaign_id && (
            <a
              href={`https://app.instantly.ai/app/campaign/${campaign.instantly_campaign_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Instantly
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Campaign Progress */}
      {analytics && analytics.leads_count > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
              <span className="font-medium">Campaign Progress</span>
              <span>
                {leadsContacted.toLocaleString()} / {analytics.leads_count.toLocaleString()} leads contacted ({progress.toFixed(0)}%)
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Total Leads</span>
              <Users className="h-5 w-5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics?.leads_count?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Emails Sent</span>
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics?.emails_sent?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Replies</span>
              <MessageSquare className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics?.emails_replied?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-400">
              {((analytics?.reply_rate || 0) * 100).toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Positive Replies</span>
              <ThumbsUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {analytics?.total_opportunities?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Bounced</span>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {analytics?.emails_bounced?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-400">
              {((analytics?.bounce_rate || 0) * 100).toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positive Replies */}
      {positiveLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              Positive Replies ({positiveLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {positiveLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-sm text-slate-600">{lead.email}</p>
                    {lead.company_name && (
                      <p className="text-xs text-slate-500">{lead.company_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700">Positive</Badge>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(lead.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Leads */}
      {recentLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-slate-600">Email</th>
                    <th className="text-left py-2 font-medium text-slate-600">Name</th>
                    <th className="text-left py-2 font-medium text-slate-600">Company</th>
                    <th className="text-left py-2 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2 font-medium text-slate-600">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="py-2">{lead.email}</td>
                      <td className="py-2">
                        {lead.first_name} {lead.last_name}
                      </td>
                      <td className="py-2 text-slate-500">{lead.company_name || "-"}</td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={lead.is_positive_reply ? "border-green-500 text-green-600" : ""}
                        >
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-500">
                        {new Date(lead.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
