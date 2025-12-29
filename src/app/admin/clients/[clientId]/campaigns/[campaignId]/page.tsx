"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText,
  Edit2,
  Check,
  X,
  Download,
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
  original_name: string | null;
  instantly_campaign_id: string | null;
  is_active: boolean;
  created_at: string;
  client_id: string;
}

interface CampaignSequence {
  id: string;
  step_number: number;
  variant: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  delay_days: number;
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
  const [sequences, setSequences] = useState<CampaignSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Sequences sync state
  const [isSyncingSequences, setIsSyncingSequences] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch campaign details, sequences, and leads
      const [campaignRes, clientRes, leadsRes, sequencesRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/details`),
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/campaigns/${campaignId}/leads`),
        fetch(`/api/campaigns/${campaignId}/sequences`),
      ]);

      if (!campaignRes.ok) {
        throw new Error("Campaign not found");
      }

      const campaignData = await campaignRes.json();
      const clientData = await clientRes.json();
      const leadsData = await leadsRes.json();
      const sequencesData = await sequencesRes.json();

      setCampaign(campaignData.campaign);
      setAnalytics(campaignData.analytics);
      setClient(clientData.client);
      setLeads(leadsData.leads || []);
      setSequences(sequencesData.sequences || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [campaignId, clientId]);

  // Save campaign name
  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === campaign?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update name");

      const data = await res.json();
      setCampaign(data.campaign);
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setIsSavingName(false);
    }
  };

  // Sync sequences from Instantly
  const handleSyncSequences = async () => {
    setIsSyncingSequences(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sequences`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to sync sequences");

      const data = await res.json();
      // Refresh sequences
      const sequencesRes = await fetch(`/api/campaigns/${campaignId}/sequences`);
      const sequencesData = await sequencesRes.json();
      setSequences(sequencesData.sequences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync sequences");
    } finally {
      setIsSyncingSequences(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {client?.name || "Client"}
        </Link>
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
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
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {client?.name || "Client"}
          </Link>
          <div className="flex items-center gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-xl font-bold h-9 w-80"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingName(false)}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">{campaign?.name}</h1>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditedName(campaign?.name || "");
                    setIsEditingName(true);
                  }}
                  title="Edit campaign name"
                >
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
            <Badge
              variant={campaign?.is_active ? "default" : "secondary"}
              className={campaign?.is_active ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : ""}
            >
              {campaign?.is_active ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Campaign Details
            {campaign?.original_name && campaign.original_name !== campaign.name && (
              <span className="ml-2 text-xs">(Originally: {campaign.original_name})</span>
            )}
          </p>
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
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span className="font-medium">Campaign Progress</span>
              <span>
                {leadsContacted.toLocaleString()} / {analytics.leads_count.toLocaleString()} leads contacted ({progress.toFixed(0)}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
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
              <span className="text-sm text-muted-foreground">Total Leads</span>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.leads_count?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Emails Sent</span>
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.emails_sent?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Replies</span>
              <MessageSquare className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.emails_replied?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {((analytics?.reply_rate || 0) * 100).toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Positive Replies</span>
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
              <span className="text-sm text-muted-foreground">Bounced</span>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.emails_bounced?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {((analytics?.bounce_rate || 0) * 100).toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email Sequences */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Email Sequences
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncSequences}
            disabled={isSyncingSequences}
          >
            <Download className={`h-4 w-4 mr-2 ${isSyncingSequences ? "animate-spin" : ""}`} />
            {isSyncingSequences ? "Syncing..." : "Sync from Instantly"}
          </Button>
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No email sequences found</p>
              <p className="text-sm mt-1">Click "Sync from Instantly" to fetch the email copy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group sequences by variant */}
              {(() => {
                const variants = [...new Set(sequences.map(s => s.variant))].sort();
                return variants.map((variant) => (
                  <div key={variant} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 font-medium">
                      Version {variant}
                    </div>
                    <div className="divide-y divide-border">
                      {sequences
                        .filter(s => s.variant === variant)
                        .sort((a, b) => a.step_number - b.step_number)
                        .map((step) => (
                          <div key={step.id} className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">Step {step.step_number}</Badge>
                              {step.delay_days > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  +{step.delay_days} day{step.delay_days > 1 ? "s" : ""} delay
                                </span>
                              )}
                            </div>
                            {step.subject && (
                              <p className="font-medium text-sm mb-2">
                                Subject: {step.subject}
                              </p>
                            )}
                            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {step.body_text || step.body_html || "(No content)"}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </CardContent>
      </Card>

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
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-100 dark:border-green-900"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                    {lead.company_name && (
                      <p className="text-xs text-muted-foreground">{lead.company_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Positive</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
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
                    <th className="text-left py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="py-2">{lead.email}</td>
                      <td className="py-2">
                        {lead.first_name} {lead.last_name}
                      </td>
                      <td className="py-2 text-muted-foreground">{lead.company_name || "-"}</td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={lead.is_positive_reply ? "border-green-500 text-green-600" : ""}
                        >
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
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
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
