"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import DOMPurify from "dompurify";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
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
  ThumbsUp,
  AlertCircle,
  FileText,
  Edit2,
  Check,
  X,
  Download,
  Eye,
  Code,
  FileDown,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { VariantAnalytics } from "@/components/campaigns/variant-analytics";
import {
  useCopyReview,
  ReviewStatusBadge,
  ReviewActions,
  ReviewableBody,
  CommentThread,
} from "@/components/campaigns/copy-review";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  smartlead_campaign_id: string | null;
  provider_type: "instantly" | "smartlead" | null;
  is_active: boolean;
  created_at: string;
  client_id: string;
  hubspot_vertical: string | null;
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
  company_domain: string | null;
  phone: string | null;
  personalization: string | null;
  status: string;
  is_positive_reply: boolean;
  has_replied: boolean | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
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
  const copyReview = useCopyReview(campaignId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  // Editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // API Key editing state
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [editedApiKey, setEditedApiKey] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySuccess, setApiKeySuccess] = useState(false);

  // HubSpot vertical editing state
  const [isEditingVertical, setIsEditingVertical] = useState(false);
  const [editedVertical, setEditedVertical] = useState("");
  const [isSavingVertical, setIsSavingVertical] = useState(false);
  const [verticalSuccess, setVerticalSuccess] = useState(false);

  // Sequences sync state
  const [isSyncingSequences, setIsSyncingSequences] = useState(false);

  // Leads sync state
  const [isSyncingLeads, setIsSyncingLeads] = useState(false);
  const [syncLeadsResult, setSyncLeadsResult] = useState<string | null>(null);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Fetch user role
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin(profile?.role === "admin");
      }
    };
    checkAdmin();
  }, []);


  // Calculate estimated sync time based on lead count
  const estimatedSyncTime = useMemo(() => {
    const leadsCount = analytics?.leads_count || 0;
    if (!leadsCount || leadsCount <= 0) return 30;
    const pages = Math.ceil(leadsCount / 100);
    const batches = Math.ceil(pages / 5);
    const apiTime = batches * 1.2;
    const dbTime = leadsCount / 500;
    return Math.ceil(apiTime + dbTime);
  }, [analytics?.leads_count]);

  // Check if already synced (local count is within 5% of provider count)
  const isAlreadySynced = useMemo(() => {
    const providerCount = analytics?.leads_count || 0;
    const localCount = leads.length;
    return providerCount > 0 && localCount > 0 &&
      Math.abs(localCount - providerCount) / providerCount < 0.05;
  }, [analytics?.leads_count, leads.length]);

  // Timer for sync progress
  useEffect(() => {
    if (isSyncingLeads) {
      setSyncElapsed(0);
      syncTimerRef.current = setInterval(() => {
        setSyncElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    }
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [isSyncingLeads]);

  // Preview mode state - default to true to show filled-in variables
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);

  // Get 3 sample leads for preview - spread across the list for variety
  const getSampleLeads = () => {
    if (leads.length === 0) return [];
    if (leads.length <= 3) return leads;
    // Pick leads from different positions for variety
    const indices = [
      0, // First lead
      Math.floor(leads.length / 2), // Middle lead
      Math.min(leads.length - 1, Math.floor(leads.length * 0.75)), // Near end
    ];
    return indices.map(i => leads[i]);
  };
  const sampleLeads = getSampleLeads();

  // Get the selected preview lead (if using single preview mode)
  const previewLead = leads.find(l => l.id === previewLeadId) || leads[0];

  // Function to replace template variables with lead data
  const replaceTemplateVariables = (content: string, lead: Lead | undefined): string => {
    if (!content || !lead) return content;

    let result = content;

    // Common curly brace variable replacements {{variable}}
    const curlyReplacements: Record<string, string> = {
      '{{firstName}}': lead.first_name || '',
      '{{first_name}}': lead.first_name || '',
      '{{lastName}}': lead.last_name || '',
      '{{last_name}}': lead.last_name || '',
      '{{email}}': lead.email || '',
      '{{companyName}}': lead.company_name || '',
      '{{company_name}}': lead.company_name || '',
      '{{company}}': lead.company_name || '',
      '{{phone}}': lead.phone || '',
      '{{domain}}': lead.company_domain || '',
      '{{company_domain}}': lead.company_domain || '',
    };

    // Apply curly brace replacements
    Object.entries(curlyReplacements).forEach(([variable, value]) => {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'gi'), value);
    });

    // Handle RANDOM variables - pick the first option for preview
    result = result.replace(/\{\{RANDOM\s*\|\s*([^}]+)\}\}/gi, (match, options) => {
      const firstOption = options.split('|')[0].trim();
      return firstOption;
    });

    // Get lead_data from metadata for custom variables
    const leadData = lead.metadata?.lead_data as Record<string, string> | undefined;

    // Map common template variables to possible payload field names
    const variableMappings: Record<string, string[]> = {
      '1st line': ['1st line', '1stLine', 'Master Line', 'masterLine', 'Icebreaker', 'icebreaker', 'personalization', 'opening_line', 'openingLine'],
      '2nd line': ['2nd line', '2ndLine', 'P.S.', 'PS', 'ps', 'postscript', 'closing_line', 'closingLine'],
      '3rd line': ['3rd line', '3rdLine', 'extra_line', 'extraLine'],
    };

    // Replace remaining curly brace variables
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedVar = varName.trim();

      // Check if there's a mapping for this variable
      const possibleKeys = variableMappings[trimmedVar] || [trimmedVar];

      // Try to find the value in lead_data
      if (leadData) {
        for (const key of possibleKeys) {
          if (leadData[key] && leadData[key].trim() !== '') {
            return leadData[key];
          }
        }
        // Also try exact match with the variable name
        if (leadData[trimmedVar] && leadData[trimmedVar].trim() !== '') {
          return leadData[trimmedVar];
        }
      }
      return '';
    });

    // Handle bracket-style placeholders [variable]
    // These are used for personalization lines and signatures

    // Common bracket-style replacements
    const bracketReplacements: Record<string, string> = {
      '[first_name]': lead.first_name || '',
      '[firstName]': lead.first_name || '',
      '[last_name]': lead.last_name || '',
      '[lastName]': lead.last_name || '',
      '[company]': lead.company_name || '',
      '[companyName]': lead.company_name || '',
      '[company_name]': lead.company_name || '',
      '[email]': lead.email || '',
      '[phone]': lead.phone || '',
      '[domain]': lead.company_domain || '',
      // Personalization - the personalization field contains the opening line
      '[1st line]': lead.personalization || '',
      '[1stLine]': lead.personalization || '',
      '[icebreaker]': lead.personalization || '',
      '[Icebreaker]': lead.personalization || '',
      // Additional lines from lead_data if available
      '[2nd line]': leadData?.['2nd line'] || leadData?.['2ndLine'] || leadData?.secondLine || '',
      '[2ndLine]': leadData?.['2nd line'] || leadData?.['2ndLine'] || leadData?.secondLine || '',
      '[3rd line]': leadData?.['3rd line'] || leadData?.['3rdLine'] || leadData?.thirdLine || '',
      '[3rdLine]': leadData?.['3rd line'] || leadData?.['3rdLine'] || leadData?.thirdLine || '',
      // Signature - remove it in preview as it's added by the email sending system
      '[accountSignature]': '',
      '[signature]': '',
      '[Signature]': '',
    };

    // Apply bracket-style replacements (case-insensitive)
    Object.entries(bracketReplacements).forEach(([variable, value]) => {
      const escapedVar = variable.replace(/[[\]]/g, '\\$&');
      result = result.replace(new RegExp(escapedVar, 'gi'), value);
    });

    // Handle any remaining bracket variables - try to find them in lead_data
    result = result.replace(/\[([^\]]+)\]/g, (match, varName) => {
      const normalizedName = varName.trim();
      // Check metadata.lead_data for custom variables
      if (leadData && leadData[normalizedName]) {
        return leadData[normalizedName];
      }
      // Also try camelCase and snake_case variants
      const camelCase = normalizedName.replace(/\s+(.)/g, (m: string, c: string) => c.toUpperCase());
      const snakeCase = normalizedName.replace(/\s+/g, '_').toLowerCase();
      if (leadData && leadData[camelCase]) {
        return leadData[camelCase];
      }
      if (leadData && leadData[snakeCase]) {
        return leadData[snakeCase];
      }
      // Return empty string instead of showing placeholder
      return '';
    });

    return result;
  };

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

  // Save API key
  const handleSaveApiKey = async () => {
    if (!editedApiKey.trim()) {
      setIsEditingApiKey(false);
      return;
    }

    setIsSavingApiKey(true);
    setApiKeyError(null);
    setApiKeySuccess(false);

    try {
      // First validate the API key
      const providerType = campaign?.provider_type || "smartlead";
      const validateEndpoint = providerType === "instantly"
        ? "/api/instantly/validate-key"
        : "/api/smartlead/validate-key";

      const validateRes = await fetch(validateEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: editedApiKey.trim() }),
      });

      const validateData = await validateRes.json();

      if (!validateData.valid) {
        setApiKeyError(validateData.error || "Invalid API key");
        setIsSavingApiKey(false);
        return;
      }

      // API key is valid, save it
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: editedApiKey.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update API key");

      setApiKeySuccess(true);
      setIsEditingApiKey(false);
      setEditedApiKey("");

      // Clear success message after 3 seconds
      setTimeout(() => setApiKeySuccess(false), 3000);
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  // Save HubSpot vertical
  const handleSaveVertical = async () => {
    setIsSavingVertical(true);
    setVerticalSuccess(false);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hubspot_vertical: editedVertical.trim() || null }),
      });

      if (!res.ok) throw new Error("Failed to update HubSpot vertical");

      const data = await res.json();
      setCampaign(data.campaign);
      setVerticalSuccess(true);
      setIsEditingVertical(false);

      // Clear success message after 3 seconds
      setTimeout(() => setVerticalSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vertical");
    } finally {
      setIsSavingVertical(false);
    }
  };

  // Sync leads from provider
  const handleSyncLeads = async () => {
    setIsSyncingLeads(true);
    setSyncLeadsResult(null);
    setError(null);

    // Create timeout abort controller (5 min timeout to match API maxDuration)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      // Skip statistics fetch for faster sync (statistics can be fetched separately if needed)
      const res = await fetch(`/api/campaigns/${campaignId}/sync-leads?skipStats=true`, {
        method: "POST",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to sync leads");
      }

      const emailInfo = data.emailSync ? `, ${data.emailSync.emailsSynced} emails` : '';
      setSyncLeadsResult(`Synced ${data.inserted} new, ${data.updated} updated${emailInfo}`);
      // Refresh data to show new leads
      await fetchData();
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Lead sync error:", err);

      // Handle abort error specifically
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Sync timed out after 5 minutes. The campaign may have too many leads.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to sync leads");
      }
    } finally {
      setIsSyncingLeads(false);
    }
  };


  // Export leads to CSV
  const handleExportLeads = async (filter: "positive_replies" | "replied_not_positive" | "no_reply" | "all") => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/export-leads?filter=${filter}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `leads_${filter}.csv`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      setError(err instanceof Error ? err.message : "Failed to export leads");
    }
  };

  // Download Claude skill file for A/B test optimization
  const handleDownloadSkill = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/generate-skill`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate skill file");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `campaign-ab-optimizer.md`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Skill download error:", err);
      setError(err instanceof Error ? err.message : "Failed to download skill file");
    }
  };

  // Sync sequences from Instantly
  const handleSyncSequences = async () => {
    setIsSyncingSequences(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sequences`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync sequences");
      }

      // Show message if synced 0 sequences
      if (data.synced === 0 && data.message) {
        console.log("Sync result:", data);
        setError(data.message);
      }

      // Refresh sequences
      const sequencesRes = await fetch(`/api/campaigns/${campaignId}/sequences`);
      const sequencesData = await sequencesRes.json();
      setSequences(sequencesData.sequences || []);
    } catch (err) {
      console.error("Sync error:", err);
      setError(err instanceof Error ? err.message : "Failed to sync sequences");
    } finally {
      setIsSyncingSequences(false);
    }
  };

  // Auto-refresh analytics from provider every 30 seconds
  const refreshAnalytics = useCallback(async () => {
    if (isSyncingLeads || loading) return; // Don't refresh while syncing or initial loading

    setIsAutoRefreshing(true);
    try {
      // Fetch campaign details with force refresh to get latest from Instantly
      const campaignRes = await fetch(`/api/campaigns/${campaignId}/details?refresh=true`);
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json();
        setCampaign(campaignData.campaign);
        setAnalytics(campaignData.analytics);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Auto-refresh failed:", err);
    } finally {
      setIsAutoRefreshing(false);
    }
  }, [campaignId, isSyncingLeads, loading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds (pauses when tab is hidden)
  useVisibilityPolling(() => refreshAnalytics(), 30000);

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
  const repliedLeads = leads.filter(l => l.has_replied && !l.is_positive_reply);
  const noReplyLeads = leads.filter(l => !l.has_replied);
  const recentLeads = leads.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              className={
                campaign?.is_active
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : progress >= 99.5
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : ""
              }
            >
              {campaign?.is_active ? "Active" : progress >= 99.5 ? "Completed" : "Paused"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Campaign Details
            {campaign?.original_name && campaign.original_name !== campaign.name && (
              <span className="ml-2 text-xs">(Originally: {campaign.original_name})</span>
            )}
          </p>
          {/* API Key Management - Admin Only */}
          {isAdmin && campaign?.provider_type && (
            <div className="mt-2">
              {isEditingApiKey ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      value={editedApiKey}
                      onChange={(e) => setEditedApiKey(e.target.value)}
                      placeholder={`Enter ${campaign.provider_type === "smartlead" ? "Smartlead" : "Instantly"} API key`}
                      className="h-8 w-80 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveApiKey();
                        if (e.key === "Escape") {
                          setIsEditingApiKey(false);
                          setEditedApiKey("");
                          setApiKeyError(null);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveApiKey}
                      disabled={isSavingApiKey}
                    >
                      {isSavingApiKey ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingApiKey(false);
                        setEditedApiKey("");
                        setApiKeyError(null);
                      }}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  {apiKeyError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {apiKeyError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Provider: {campaign.provider_type === "smartlead" ? "Smartlead" : "Instantly"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingApiKey(true)}
                    className="h-6 text-xs"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Update API Key
                  </Button>
                  {apiKeySuccess && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      API key updated
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {/* HubSpot Vertical - Admin Only */}
          {isAdmin && (
            <div className="mt-2">
              {isEditingVertical ? (
                <div className="flex items-center gap-2">
                  <select
                    value={editedVertical}
                    onChange={(e) => setEditedVertical(e.target.value)}
                    className="h-8 w-48 text-sm border rounded px-2 bg-background"
                    autoFocus
                  >
                    <option value="">Select Vertical</option>
                    <option value="Fintechs">Fintechs</option>
                    <option value="Universities">Universities</option>
                    <option value="Asset Managers">Asset Managers</option>
                    <option value="Hedge Funds">Hedge Funds</option>
                    <option value="Other">Other</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveVertical}
                    disabled={isSavingVertical}
                  >
                    {isSavingVertical ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingVertical(false);
                      setEditedVertical(campaign?.hubspot_vertical || "");
                    }}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    HubSpot Vertical: {campaign?.hubspot_vertical || "Not set"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditedVertical(campaign?.hubspot_vertical || "");
                      setIsEditingVertical(true);
                    }}
                    className="h-6 text-xs"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Set Vertical
                  </Button>
                  {verticalSuccess && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Vertical updated
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sync Progress (only shows when syncing) */}
          {isSyncingLeads && (
            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${Math.min((syncElapsed / estimatedSyncTime) * 100, 95)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Syncing... {syncElapsed}s
              </span>
            </div>
          )}

          {/* Export Dropdown - Primary Action */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => handleExportLeads("positive_replies")}
                className="cursor-pointer"
              >
                <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
                <div>
                  <div className="font-medium">Positive Replies</div>
                  <div className="text-xs text-muted-foreground">
                    {positiveLeads.length} leads
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportLeads("replied_not_positive")}
                className="cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 mr-2 text-amber-500" />
                <div>
                  <div className="font-medium">Replied (Not Positive)</div>
                  <div className="text-xs text-muted-foreground">
                    {repliedLeads.length} leads
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExportLeads("no_reply")}
                className="cursor-pointer"
              >
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                <div>
                  <div className="font-medium">No Reply</div>
                  <div className="text-xs text-muted-foreground">
                    All leads that haven't replied
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExportLeads("all")}
                className="cursor-pointer"
              >
                <Users className="h-4 w-4 mr-2 text-blue-500" />
                <div>
                  <div className="font-medium">All Leads</div>
                  <div className="text-xs text-muted-foreground">
                    Export entire lead list
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Skill Download - Admin Only */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSkill}
              title="Download Claude skill file for A/B test optimization"
            >
              <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
              AI Skill
            </Button>
          )}

          {/* Options Dropdown - Secondary Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={fetchData}
                disabled={loading}
                className="cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                <div>
                  <div className="font-medium">Refresh Page</div>
                  <div className="text-xs text-muted-foreground">
                    Reload data from database
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSyncLeads}
                disabled={isSyncingLeads}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                <div>
                  <div className="font-medium">Re-sync from Provider</div>
                  <div className="text-xs text-muted-foreground">
                    {isSyncingLeads ? "Syncing..." : `Pull latest from ${campaign?.instantly_campaign_id ? "Instantly" : "Smartlead"}`}
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sync Result Message */}
      {syncLeadsResult && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          {syncLeadsResult}
        </div>
      )}

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

      {/* A/B Test Variant Analytics */}
      <VariantAnalytics campaignId={campaignId} />

      {/* Email Sequences */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Email Sequences
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Preview Mode Toggle */}
              {sequences.length > 0 && leads.length > 0 && (
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setIsPreviewMode(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      !isPreviewMode
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code className="h-4 w-4" />
                    Variables
                  </button>
                  <button
                    onClick={() => setIsPreviewMode(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isPreviewMode
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </div>
              )}

              {/* Lead Selector for Preview */}
              {isPreviewMode && leads.length > 0 && (
                <Select
                  value={previewLeadId || leads[0]?.id}
                  onValueChange={setPreviewLeadId}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select a lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.slice(0, 20).map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.first_name || lead.email.split('@')[0]} - {lead.company_name || 'No company'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncSequences}
                disabled={isSyncingSequences}
              >
                <Download className={`h-4 w-4 mr-2 ${isSyncingSequences ? "animate-spin" : ""}`} />
                {isSyncingSequences ? "Syncing..." : "Sync Templates"}
              </Button>
            </div>
          </div>

          {/* Preview Lead Info */}
          {isPreviewMode && previewLead && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>
                Previewing as: <strong className="text-foreground">{previewLead.first_name || previewLead.email.split('@')[0]}</strong>
                {previewLead.company_name && <> from <strong className="text-foreground">{previewLead.company_name}</strong></>}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No email sequences found</p>
              <p className="text-sm mt-1">
                Click "Sync Templates" to fetch email copy from {campaign?.provider_type === "smartlead" ? "Smartlead" : "Instantly"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group sequences by variant */}
              {(() => {
                const variants = [...new Set(sequences.map(s => s.variant))].sort();
                return variants.map((variant) => {
                  const steps = sequences
                    .filter(s => s.variant === variant)
                    .sort((a, b) => a.step_number - b.step_number);

                  return (
                    <div key={variant} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 font-medium flex items-center justify-between">
                        <span>Version {variant}</span>
                        {steps.length > 0 && (
                          <ReviewStatusBadge review={copyReview.getReview(steps[0].step_number, variant)} />
                        )}
                      </div>
                      <div className="divide-y divide-border">
                        {steps.map((step) => {
                          const review = copyReview.getReview(step.step_number, variant);
                          const variantComments = copyReview.getComments(step.step_number, variant);

                          const showPreview = isPreviewMode && previewLead;
                          const subject = showPreview
                            ? replaceTemplateVariables(step.subject || "", previewLead)
                            : step.subject;
                          const body = showPreview
                            ? replaceTemplateVariables(step.body_html || step.body_text || "", previewLead)
                            : (step.body_html || step.body_text || "<p>(No content)</p>");
                          const sanitizedBody = DOMPurify.sanitize(body, { ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "a", "ul", "ol", "li", "blockquote", "div", "span", "h1", "h2", "h3", "table", "tr", "td", "th", "tbody", "thead"], ALLOWED_ATTR: ["href", "target", "rel", "style"], ALLOW_DATA_ATTR: false });

                          return (
                            <div key={step.id} className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">Step {step.step_number}</Badge>
                                {step.delay_days > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{step.delay_days} day{step.delay_days > 1 ? "s" : ""} delay
                                  </span>
                                )}
                              </div>

                              {subject && (
                                <p className="font-medium text-sm mb-2">Subject: {subject}</p>
                              )}

                              {/* Reviewable body with inline commenting */}
                              <div className="bg-muted/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                                <ReviewableBody
                                  bodyHtml={sanitizedBody}
                                  comments={variantComments}
                                  stepNumber={step.step_number}
                                  variant={variant}
                                  onAddComment={copyReview.addComment}
                                />
                              </div>

                              {/* Comments thread */}
                              <CommentThread
                                comments={variantComments}
                                onResolve={copyReview.resolveComment}
                                onUnresolve={copyReview.unresolveComment}
                                onDelete={copyReview.deleteComment}
                              />

                              {/* Approve / Reject actions */}
                              <div className="mt-3">
                                <ReviewActions
                                  review={review}
                                  onApprove={() => copyReview.submitReview(step.step_number, variant, "approved")}
                                  onReject={(comment) => copyReview.submitReview(step.step_number, variant, "rejected", comment)}
                                  onReset={() => copyReview.submitReview(step.step_number, variant, "pending")}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
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
        <p className="text-xs text-muted-foreground text-right flex items-center justify-end gap-2">
          {isAutoRefreshing && (
            <RefreshCw className="h-3 w-3 animate-spin" />
          )}
          <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </p>
      )}
    </div>
  );
}
