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
  CheckCircle,
  Calendar,
  Trophy,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_domain: string | null;
  status: string;
  has_replied: boolean;
  is_positive_reply: boolean;
  responded_at: string | null;
  meeting_at: string | null;
  closed_at: string | null;
  notes: string | null;
  campaign_name: string | null;
  created_at: string;
  updated_at: string;
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
  const [positiveLeads, setPositiveLeads] = useState<Lead[]>([]);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState("");
  const [meetingDateInput, setMeetingDateInput] = useState("");
  const [showMeetingInput, setShowMeetingInput] = useState<string | null>(null);

  const fetchPositiveLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/leads?positive=true&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setPositiveLeads(data.leads || []);
      }
    } catch (err) {
      console.error("Failed to fetch positive leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  }, [clientId]);

  const handleWorkflowAction = async (
    leadId: string,
    action: "mark_responded" | "schedule_meeting" | "close_won" | "close_lost" | "update_notes" | "revert_status",
    extraData?: { meeting_at?: string; notes?: string }
  ) => {
    console.log("Workflow action:", { leadId, action, extraData });
    setUpdatingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extraData }),
      });

      const data = await res.json();
      console.log("Workflow response:", data);

      if (res.ok) {
        // Refresh leads after update
        await fetchPositiveLeads();
        setEditingNotesId(null);
        setShowMeetingInput(null);
        setNotesInput("");
        setMeetingDateInput("");
      } else {
        alert(data.error || "Failed to update lead");
      }
    } catch (err) {
      console.error("Workflow error:", err);
      alert("Failed to update lead: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUpdatingLeadId(null);
    }
  };

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
    fetchPositiveLeads();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchClientData(true);
      fetchPositiveLeads();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchClientData, fetchPositiveLeads]);

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
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
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Center
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">
                {client?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{client?.name}</h1>
              <p className="text-muted-foreground text-sm">Campaign Performance Dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
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
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Emails Sent</span>
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalEmailsSent.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Reply Rate</span>
              <MessageSquare className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.replyRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">{stats.totalReplies.toLocaleString()} replies</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Positive Replies</span>
              <ThumbsUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalPositiveReplies.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Campaigns</span>
              <Zap className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">of {stats.totalCampaigns} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel Analytics */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Funnel Visualization */}
            <div className="grid grid-cols-6 gap-2">
              {/* Contacted */}
              <div className="text-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 mb-2">
                  <Users className="h-6 w-6 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {campaigns.reduce((sum, c) => sum + (c.analytics?.contacted_count || 0), 0).toLocaleString()}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Contacted</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center text-muted-foreground">
                →
              </div>

              {/* Opened */}
              <div className="text-center">
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3 mb-2">
                  <Eye className="h-6 w-6 mx-auto text-purple-600 dark:text-purple-400 mb-1" />
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {stats.totalOpened.toLocaleString()}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Opened</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">{stats.openRate.toFixed(1)}%</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center text-muted-foreground">
                →
              </div>

              {/* Replied */}
              <div className="text-center">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 mb-2">
                  <MessageSquare className="h-6 w-6 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.totalReplies.toLocaleString()}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Replied</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{stats.replyRate.toFixed(1)}%</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center text-muted-foreground">
                →
              </div>
            </div>

            {/* Second Row - Positive → Meeting → Closed */}
            <div className="grid grid-cols-5 gap-2 pt-2">
              {/* Positive Replies */}
              <div className="text-center">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 mb-2">
                  <ThumbsUp className="h-6 w-6 mx-auto text-green-600 dark:text-green-400 mb-1" />
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {stats.totalPositiveReplies.toLocaleString()}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Positive</p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {stats.totalReplies > 0 ? ((stats.totalPositiveReplies / stats.totalReplies) * 100).toFixed(0) : 0}% of replies
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center text-muted-foreground">
                →
              </div>

              {/* Meetings */}
              <div className="text-center">
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 mb-2">
                  <Calendar className="h-6 w-6 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {positiveLeads.filter(l => l.status === "meeting" || l.meeting_at).length}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Meetings</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {stats.totalPositiveReplies > 0 ? ((positiveLeads.filter(l => l.status === "meeting" || l.meeting_at).length / stats.totalPositiveReplies) * 100).toFixed(0) : 0}% conversion
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center text-muted-foreground">
                →
              </div>

              {/* Closed */}
              <div className="text-center">
                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 mb-2">
                  <Trophy className="h-6 w-6 mx-auto text-amber-600 dark:text-amber-400 mb-1" />
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {positiveLeads.filter(l => l.status === "closed_won").length}
                    <span className="text-sm text-muted-foreground font-normal">
                      /{positiveLeads.filter(l => l.status === "closed_won" || l.status === "closed_lost").length}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Won/Closed</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {positiveLeads.filter(l => l.status === "closed_won" || l.status === "closed_lost").length > 0
                    ? ((positiveLeads.filter(l => l.status === "closed_won").length / positiveLeads.filter(l => l.status === "closed_won" || l.status === "closed_lost").length) * 100).toFixed(0)
                    : 0}% win rate
                </p>
              </div>
            </div>

            {/* Campaign Performance Breakdown */}
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Campaign Performance Breakdown</h4>
              <div className="space-y-2">
                {campaigns.map((campaign) => {
                  const analytics = campaign.analytics;
                  const sent = analytics?.emails_sent || 0;
                  const replied = analytics?.emails_replied || 0;
                  const positive = analytics?.total_opportunities || 0;
                  const replyRate = sent > 0 ? (replied / sent * 100) : 0;
                  const positiveRate = replied > 0 ? (positive / replied * 100) : 0;

                  return (
                    <div key={campaign.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Link
                          href={`/admin/clients/${clientId}/campaigns/${campaign.id}`}
                          className="text-sm font-medium text-foreground hover:text-blue-600 truncate max-w-[60%]"
                        >
                          {campaign.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge variant={campaign.status === "active" ? "default" : "secondary"} className="text-xs">
                            {campaign.status || "paused"}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Sent:</span>
                          <span className="ml-1 font-medium">{sent.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Replies:</span>
                          <span className="ml-1 font-medium">{replied}</span>
                          <span className="text-muted-foreground ml-1">({replyRate.toFixed(1)}%)</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Positive:</span>
                          <span className="ml-1 font-medium text-green-600">{positive}</span>
                          <span className="text-muted-foreground ml-1">({positiveRate.toFixed(0)}%)</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bounced:</span>
                          <span className="ml-1 font-medium text-red-500">{analytics?.emails_bounced || 0}</span>
                          <span className="text-muted-foreground ml-1">({analytics?.bounce_rate?.toFixed(1) || 0}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead Workflow Management */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
              Lead Workflow
              {positiveLeads.length > 0 && (
                <Badge variant="secondary">{positiveLeads.length}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchPositiveLeads()}
                disabled={loadingLeads}
              >
                <RefreshCw className={`h-4 w-4 ${loadingLeads ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorkflow(!showWorkflow)}
              >
                {showWorkflow ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {/* Stats Summary */}
          {positiveLeads.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Responded:</span>
                <span className="font-medium">
                  {positiveLeads.filter(l => l.responded_at).length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Meetings:</span>
                <span className="font-medium">
                  {positiveLeads.filter(l => l.status === "meeting" || l.meeting_at).length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Won:</span>
                <span className="font-medium text-green-600">
                  {positiveLeads.filter(l => l.status === "closed_won").length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">Lost:</span>
                <span className="font-medium text-red-500">
                  {positiveLeads.filter(l => l.status === "closed_lost").length}
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        {showWorkflow && (
          <CardContent>
            {loadingLeads && positiveLeads.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : positiveLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ThumbsUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="font-medium">No positive replies yet</p>
                <p className="text-sm mt-1">
                  Positive replies will appear here for workflow management.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {positiveLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="border border-border rounded-lg p-4 relative"
                  >
                    {/* Lead Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {/* Show email username if first_name looks like salutation */}
                            {lead.first_name && !lead.first_name.toLowerCase().startsWith("sehr geehrte")
                              ? `${lead.first_name}${lead.last_name ? ` ${lead.last_name}` : ""}`
                              : lead.email.split("@")[0]}
                          </span>
                          <Badge
                            variant={
                              lead.status === "closed_won"
                                ? "default"
                                : lead.status === "closed_lost"
                                ? "destructive"
                                : "secondary"
                            }
                            className={
                              lead.status === "closed_won"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : lead.status === "meeting"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : ""
                            }
                          >
                            {lead.status === "closed_won"
                              ? "Won"
                              : lead.status === "closed_lost"
                              ? "Lost"
                              : lead.status === "meeting"
                              ? "Meeting"
                              : lead.status === "replied"
                              ? "Replied"
                              : lead.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                        {lead.company_name && (
                          <p className="text-sm text-muted-foreground">{lead.company_name}</p>
                        )}
                        {lead.campaign_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Campaign: {lead.campaign_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Timeline indicators */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                      {lead.responded_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Responded: {new Date(lead.responded_at).toLocaleDateString()}
                        </span>
                      )}
                      {lead.meeting_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-blue-500" />
                          Meeting: {new Date(lead.meeting_at).toLocaleDateString()}
                        </span>
                      )}
                      {lead.closed_at && (
                        <span className="flex items-center gap-1">
                          {lead.status === "closed_won" ? (
                            <Trophy className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          Closed: {new Date(lead.closed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {!lead.responded_at && lead.status !== "closed_won" && lead.status !== "closed_lost" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWorkflowAction(lead.id, "mark_responded")}
                          disabled={updatingLeadId === lead.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Responded
                        </Button>
                      )}

                      {lead.status !== "meeting" && lead.status !== "closed_won" && lead.status !== "closed_lost" && (
                        <>
                          {showMeetingInput === lead.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="datetime-local"
                                value={meetingDateInput}
                                onChange={(e) => setMeetingDateInput(e.target.value)}
                                className="w-auto text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (meetingDateInput) {
                                    handleWorkflowAction(lead.id, "schedule_meeting", {
                                      meeting_at: new Date(meetingDateInput).toISOString(),
                                    });
                                  }
                                }}
                                disabled={!meetingDateInput || updatingLeadId === lead.id}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setShowMeetingInput(null);
                                  setMeetingDateInput("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowMeetingInput(lead.id)}
                              disabled={updatingLeadId === lead.id}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Schedule Meeting
                            </Button>
                          )}
                        </>
                      )}

                      {lead.status !== "closed_won" && lead.status !== "closed_lost" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleWorkflowAction(lead.id, "close_won")}
                            disabled={updatingLeadId === lead.id}
                          >
                            <Trophy className="h-4 w-4 mr-1" />
                            Close Won
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleWorkflowAction(lead.id, "close_lost")}
                            disabled={updatingLeadId === lead.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Close Lost
                          </Button>
                        </>
                      )}

                      {(lead.status === "closed_won" || lead.status === "closed_lost" || lead.status === "meeting") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => handleWorkflowAction(lead.id, "revert_status")}
                          disabled={updatingLeadId === lead.id}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Revert
                        </Button>
                      )}
                    </div>

                    {/* Notes Section */}
                    <div className="border-t border-border pt-3">
                      {editingNotesId === lead.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={notesInput}
                            onChange={(e) => setNotesInput(e.target.value)}
                            placeholder="Add notes about this lead..."
                            className="text-sm"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleWorkflowAction(lead.id, "update_notes", { notes: notesInput })
                              }
                              disabled={updatingLeadId === lead.id}
                            >
                              Save Notes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNotesId(null);
                                setNotesInput("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer group"
                          onClick={() => {
                            setEditingNotesId(lead.id);
                            setNotesInput(lead.notes || "");
                          }}
                        >
                          {lead.notes ? (
                            <p className="text-sm text-muted-foreground group-hover:text-foreground">
                              {lead.notes}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground/50 group-hover:text-muted-foreground">
                              Click to add notes...
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Loading overlay */}
                    {updatingLeadId === lead.id && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

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
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
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
        <p className="text-xs text-muted-foreground text-right">
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
    <div className="border border-border rounded-lg p-4 hover:border-muted-foreground/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/admin/clients/${clientId}/campaigns/${campaign.id}`}
              className="font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              {campaign.name}
            </Link>
            <Badge
              variant={campaign.is_active ? "default" : "secondary"}
              className={campaign.is_active ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : ""}
            >
              {campaign.is_active ? "Active" : "Paused"}
            </Badge>
          </div>

          {hasAnalytics ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Sent</p>
                <p className="text-lg font-semibold text-foreground">
                  {analytics.emails_sent.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Replies</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {analytics.emails_replied.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({(analytics.reply_rate * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Positive</p>
                <p className="text-lg font-semibold text-green-600">
                  {(analytics.total_opportunities || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Bounced</p>
                <p className="text-lg font-semibold text-foreground">
                  {analytics.emails_bounced.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({(analytics.bounce_rate * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">No analytics data available yet</p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="text-muted-foreground hover:text-red-500 disabled:opacity-50"
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
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Campaign Progress</span>
              <span>
                {leadsContacted.toLocaleString()} / {analytics.leads_count.toLocaleString()} leads contacted
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
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
