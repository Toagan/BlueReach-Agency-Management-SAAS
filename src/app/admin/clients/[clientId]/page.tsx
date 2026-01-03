"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
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
  Target,
  DollarSign,
  Settings,
  Lightbulb,
  Building2,
  MessageSquareText,
  Send,
  Reply,
  Download,
  Webhook,
  Copy,
  Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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
  logo_url?: string;
  website?: string;
  notes?: string;
  product_service?: string;
  acv?: number;
  tcv?: number;
  verticals?: string[];
  tam?: number;
  target_daily_emails?: number;
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

interface LeadEmail {
  id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  sent_at: string | null;
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
  const [showWorkflow, setShowWorkflow] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState("");

  // Email viewing state
  const [expandedEmailLeadId, setExpandedEmailLeadId] = useState<string | null>(null);
  const [leadEmails, setLeadEmails] = useState<Record<string, LeadEmail[]>>({});
  const [loadingEmailsForLead, setLoadingEmailsForLead] = useState<string | null>(null);
  const [syncingEmailsForLead, setSyncingEmailsForLead] = useState<string | null>(null);
  const [syncingPositiveLeads, setSyncingPositiveLeads] = useState(false);

  const fetchEmailsForLead = async (leadId: string) => {
    setLoadingEmailsForLead(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/emails`);
      if (res.ok) {
        const data = await res.json();
        setLeadEmails((prev) => ({ ...prev, [leadId]: data.emails || [] }));
      }
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    } finally {
      setLoadingEmailsForLead(null);
    }
  };

  const syncEmailsForLead = async (leadId: string) => {
    setSyncingEmailsForLead(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/emails`, { method: "POST" });
      if (res.ok) {
        // Refresh emails after sync
        await fetchEmailsForLead(leadId);
      }
    } catch (err) {
      console.error("Failed to sync emails:", err);
    } finally {
      setSyncingEmailsForLead(null);
    }
  };

  const toggleEmailView = async (leadId: string) => {
    if (expandedEmailLeadId === leadId) {
      setExpandedEmailLeadId(null);
    } else {
      setExpandedEmailLeadId(leadId);
      // Fetch emails if we don't have them yet
      if (!leadEmails[leadId]) {
        await fetchEmailsForLead(leadId);
      }
    }
  };

  const syncPositiveLeads = async () => {
    setSyncingPositiveLeads(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/sync-positive`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        console.log("Sync result:", data);
        // Refresh leads after sync
        await fetchPositiveLeads();
      }
    } catch (err) {
      console.error("Failed to sync positive leads:", err);
    } finally {
      setSyncingPositiveLeads(false);
    }
  };

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
        setNotesInput("");
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

      // Return the positive count for auto-sync check
      return totalPositiveReplies;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      return 0;
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
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              {client?.logo_url ? (
                <Image
                  src={client.logo_url}
                  alt={`${client.name} logo`}
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                  unoptimized={client.logo_url.startsWith("data:")}
                />
              ) : (
                <span className="text-lg font-bold text-muted-foreground">
                  {client?.name?.charAt(0).toUpperCase()}
                </span>
              )}
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

      {/* Client Intelligence - at the top */}
      {(client?.notes || client?.product_service || client?.acv || client?.tcv || client?.verticals?.length || client?.tam) && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Client Intelligence
              </CardTitle>
              <Link href={`/admin/clients/${clientId}/settings`}>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Notes */}
            {client.notes && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4" />
                  Notes
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}

            {/* Product/Service */}
            {client.product_service && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Product/Service</p>
                <p className="text-foreground">{client.product_service}</p>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {client.tam && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Target className="h-3 w-3" />
                    TAM
                  </div>
                  <p className="font-semibold text-foreground">
                    {client.tam.toLocaleString()} leads
                  </p>
                </div>
              )}
              {client.acv && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    ACV
                  </div>
                  <p className="font-semibold text-foreground">
                    ${client.acv.toLocaleString()}
                  </p>
                </div>
              )}
              {client.tcv && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    TCV
                  </div>
                  <p className="font-semibold text-foreground">
                    ${client.tcv.toLocaleString()}
                  </p>
                </div>
              )}
              {client.target_daily_emails && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Mail className="h-3 w-3" />
                    Daily Target
                  </div>
                  <p className="font-semibold text-foreground">
                    {client.target_daily_emails.toLocaleString()} emails
                  </p>
                </div>
              )}
            </div>

            {/* Verticals */}
            {client.verticals && client.verticals.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Target Verticals
                </p>
                <div className="flex flex-wrap gap-2">
                  {client.verticals.map((vertical, index) => (
                    <Badge key={index} variant="secondary">
                      {vertical}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
              {stats.totalPositiveReplies > positiveLeads.length && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950">
                  {stats.totalPositiveReplies - positiveLeads.length} missing
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {stats.totalPositiveReplies > positiveLeads.length && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncPositiveLeads}
                  disabled={syncingPositiveLeads}
                  className="text-amber-600 hover:text-amber-700 border-amber-300"
                >
                  {syncingPositiveLeads ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Sync
                </Button>
              )}
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
                  {positiveLeads.filter(l => l.status === "booked" || l.meeting_at).length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Won:</span>
                <span className="font-medium text-green-600">
                  {positiveLeads.filter(l => l.status === "won").length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">Lost:</span>
                <span className="font-medium text-red-500">
                  {positiveLeads.filter(l => l.status === "lost").length}
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
                              lead.status === "won"
                                ? "default"
                                : lead.status === "lost"
                                ? "destructive"
                                : "secondary"
                            }
                            className={
                              lead.status === "won"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : lead.status === "booked"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : ""
                            }
                          >
                            {lead.status === "won"
                              ? "Won"
                              : lead.status === "lost"
                              ? "Lost"
                              : lead.status === "booked"
                              ? "Meeting Booked"
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
                          {lead.status === "won" ? (
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
                      {!lead.responded_at && lead.status !== "won" && lead.status !== "lost" && (
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

                      {lead.status !== "booked" && lead.status !== "won" && lead.status !== "lost" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWorkflowAction(lead.id, "schedule_meeting", {
                            meeting_at: new Date().toISOString(),
                          })}
                          disabled={updatingLeadId === lead.id}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Schedule Meeting
                        </Button>
                      )}

                      {lead.status !== "won" && lead.status !== "lost" && (
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

                      {(lead.status === "won" || lead.status === "lost" || lead.status === "booked") && (
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

                    {/* View Emails Button */}
                    <div className="mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleEmailView(lead.id)}
                        disabled={loadingEmailsForLead === lead.id}
                        className="w-full justify-between"
                      >
                        <span className="flex items-center">
                          <MessageSquareText className="h-4 w-4 mr-2" />
                          View Email Exchange
                        </span>
                        {loadingEmailsForLead === lead.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : expandedEmailLeadId === lead.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Email Exchange Section */}
                    {expandedEmailLeadId === lead.id && (
                      <div className="mb-3 border border-border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Email Thread
                            {leadEmails[lead.id] && leadEmails[lead.id].length > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({leadEmails[lead.id].length} {leadEmails[lead.id].length === 1 ? "email" : "emails"})
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => fetchEmailsForLead(lead.id)}
                              disabled={loadingEmailsForLead === lead.id}
                              className="h-7 text-xs"
                              title="Refresh emails"
                            >
                              <RefreshCw className={`h-3 w-3 ${loadingEmailsForLead === lead.id ? "animate-spin" : ""}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => syncEmailsForLead(lead.id)}
                              disabled={syncingEmailsForLead === lead.id}
                              className="h-7 text-xs"
                              title="Fetch latest emails from Instantly"
                            >
                              {syncingEmailsForLead === lead.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Fetch from Instantly
                            </Button>
                          </div>
                        </div>
                        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
                          {loadingEmailsForLead === lead.id ? (
                            <div className="flex items-center justify-center py-4">
                              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : !leadEmails[lead.id] || leadEmails[lead.id].length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                              <MessageSquareText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No emails found</p>
                              <p className="text-xs mt-1">
                                Emails are synced automatically via webhooks.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => syncEmailsForLead(lead.id)}
                                disabled={syncingEmailsForLead === lead.id}
                                className="mt-3"
                              >
                                {syncingEmailsForLead === lead.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                Fetch from Instantly
                              </Button>
                            </div>
                          ) : (
                            leadEmails[lead.id]
                              .filter((email) => email.body_text || email.body_html)
                              .map((email) => {
                                // Extract text content - prefer body_text, fall back to stripped HTML
                                let content = email.body_text;
                                if (!content && email.body_html) {
                                  // Strip HTML tags for display
                                  content = email.body_html
                                    .replace(/<br\s*\/?>/gi, '\n')
                                    .replace(/<\/p>/gi, '\n')
                                    .replace(/<[^>]+>/g, '')
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .trim();
                                }
                                if (!content) return null;

                                return (
                                  <div
                                    key={email.id}
                                    className={`rounded-lg p-3 ${
                                      email.direction === "outbound"
                                        ? "bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500"
                                        : "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {email.direction === "outbound" ? (
                                          <Send className="h-3 w-3 text-blue-500" />
                                        ) : (
                                          <Reply className="h-3 w-3 text-green-500" />
                                        )}
                                        <span className="text-xs font-medium text-muted-foreground">
                                          {email.direction === "outbound" ? "You" : lead.email.split("@")[0]}
                                        </span>
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {email.sent_at
                                          ? new Date(email.sent_at).toLocaleDateString()
                                          : ""}
                                      </span>
                                    </div>
                                    <div className="text-sm text-foreground whitespace-pre-wrap">
                                      {content}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}

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
  const [showWebhook, setShowWebhook] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInstantlyDeleteConfirm, setShowInstantlyDeleteConfirm] = useState(false);
  const [deletingFromInstantly, setDeletingFromInstantly] = useState(false);
  const analytics = campaign.analytics;
  const hasAnalytics = analytics && analytics.emails_sent > 0;

  const handleDeleteFromInstantly = async () => {
    if (!campaign.instantly_campaign_id) {
      alert("This campaign is not linked to Instantly");
      return;
    }

    setDeletingFromInstantly(true);
    try {
      const res = await fetch(`/api/instantly/campaigns/${campaign.instantly_campaign_id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete from Instantly");
      }

      const data = await res.json();
      alert(data.message || "Campaign deleted from Instantly successfully");
      setShowInstantlyDeleteConfirm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign from Instantly");
    } finally {
      setDeletingFromInstantly(false);
    }
  };

  // Generate webhook URL
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/instantly/${campaign.id}`
    : `/api/webhooks/instantly/${campaign.id}`;

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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

      {/* Webhook Configuration */}
      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => setShowWebhook(!showWebhook)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Webhook className="h-4 w-4" />
          <span>Webhook for Instantly</span>
          {showWebhook ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showWebhook && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyWebhookUrl}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Setup in Instantly:</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-700 dark:text-amber-300">
                <li>Open this campaign in Instantly</li>
                <li>Go to <span className="font-medium">Campaign Settings</span> → <span className="font-medium">Webhooks</span></li>
                <li>Click <span className="font-medium">Add Webhook</span></li>
                <li>Paste the URL above</li>
                <li>Select these events:</li>
              </ol>
              <div className="mt-2 ml-4 space-y-1">
                <p className="text-amber-700 dark:text-amber-300">
                  <span className="font-medium text-green-700 dark:text-green-400">Positive:</span>{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">lead_interested</code>,{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">lead_meeting_booked</code>,{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">lead_meeting_completed</code>,{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">lead_closed</code>
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  <span className="font-medium text-red-700 dark:text-red-400">Negative:</span>{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">lead_not_interested</code>,{" "}
                  <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">lead_neutral</code>
                </p>
              </div>
              <p className="mt-3 text-amber-600 dark:text-amber-400 italic">
                When Instantly fires these events, positive replies will sync automatically in real-time.
              </p>
            </div>

            {/* Delete from Instantly - Admin Only */}
            {campaign.instantly_campaign_id && (
              <div className="mt-4 pt-4 border-t border-border">
                {!showInstantlyDeleteConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInstantlyDeleteConfirm(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete from Instantly
                  </Button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Are you sure you want to delete this campaign from Instantly?
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                      This will permanently delete the campaign from Instantly. Your local campaign data and leads will NOT be affected.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteFromInstantly}
                        disabled={deletingFromInstantly}
                      >
                        {deletingFromInstantly ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Yes, Delete from Instantly
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowInstantlyDeleteConfirm(false)}
                        disabled={deletingFromInstantly}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
