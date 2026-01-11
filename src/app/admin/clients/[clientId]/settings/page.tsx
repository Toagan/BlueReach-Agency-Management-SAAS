"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Save, Check, AlertCircle, RefreshCw, Trash2, UserPlus, Mail, X, Users, Bell, BarChart3, Send, Zap, Link2, Unlink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";

interface ClientData {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  notes?: string;
  product_service?: string;
  icp?: string;
  acv?: number;
  tcv?: number;
  verticals?: string[];
  tam?: number;
  target_daily_emails?: number;
}

interface ClientUser {
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface NotificationUser {
  id: string;
  email: string;
  name: string;
  role: string;
  notificationsEnabled: boolean;
}

export default function ClientSettingsPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client Intelligence fields
  const [productService, setProductService] = useState("");
  const [icp, setIcp] = useState("");
  const [acv, setAcv] = useState("");
  const [tcv, setTcv] = useState("");
  const [verticals, setVerticals] = useState("");
  const [tam, setTam] = useState("");
  const [targetDailyEmails, setTargetDailyEmails] = useState("");

  // Team/Invitation state
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Notification preferences state
  const [notificationUsers, setNotificationUsers] = useState<NotificationUser[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Stats report settings
  const [statsReportInterval, setStatsReportInterval] = useState("disabled");
  const [loadingStatsSettings, setLoadingStatsSettings] = useState(true);
  const [savingStatsSettings, setSavingStatsSettings] = useState(false);
  const [sendingTestReport, setSendingTestReport] = useState(false);

  // HubSpot settings
  const [hubspotEnabled, setHubspotEnabled] = useState(false);
  const [hubspotHasToken, setHubspotHasToken] = useState(false);
  const [hubspotAccessToken, setHubspotAccessToken] = useState("");
  const [hubspotLastSync, setHubspotLastSync] = useState<string | null>(null);
  const [hubspotSyncCount, setHubspotSyncCount] = useState(0);
  const [loadingHubspot, setLoadingHubspot] = useState(true);
  const [savingHubspot, setSavingHubspot] = useState(false);
  const [disconnectingHubspot, setDisconnectingHubspot] = useState(false);
  const [testingHubspot, setTestingHubspot] = useState(false);

  const fetchNotificationPreferences = async () => {
    setLoadingNotifications(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notification-preferences`);
      const data = await res.json();
      setNotificationUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const toggleNotification = async (userId: string, enabled: boolean) => {
    setTogglingUser(userId);
    try {
      const res = await fetch(`/api/clients/${clientId}/notification-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, enabled }),
      });

      if (res.ok) {
        setNotificationUsers((users) =>
          users.map((user) =>
            user.id === userId ? { ...user, notificationsEnabled: enabled } : user
          )
        );
      }
    } catch (error) {
      console.error("Error toggling notification:", error);
    } finally {
      setTogglingUser(null);
    }
  };

  const fetchStatsSettings = async () => {
    setLoadingStatsSettings(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/stats-settings`);
      if (res.ok) {
        const data = await res.json();
        setStatsReportInterval(data.interval || "disabled");
      }
    } catch (error) {
      console.error("Error fetching stats settings:", error);
    } finally {
      setLoadingStatsSettings(false);
    }
  };

  const saveStatsInterval = async (interval: string) => {
    setSavingStatsSettings(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/stats-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      if (res.ok) {
        setStatsReportInterval(interval);
        setSuccess(interval === "disabled" ? "Stats reports disabled" : `Stats reports set to ${interval}`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save stats settings");
      }
    } catch (error) {
      console.error("Error saving stats settings:", error);
      setError("Failed to save stats settings");
    } finally {
      setSavingStatsSettings(false);
    }
  };

  const sendTestReport = async () => {
    setSendingTestReport(true);
    try {
      const res = await fetch(`/api/cron/stats-report?clientId=${clientId}&interval=${statsReportInterval === "disabled" ? "weekly" : statsReportInterval}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const recipientCount = data.totalRecipients || 0;
        setSuccess(`Test report sent to ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}`);
      } else {
        setError(data.error || "Failed to send test report");
      }
    } catch (error) {
      console.error("Error sending test report:", error);
      setError("Failed to send test report");
    } finally {
      setSendingTestReport(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  const fetchHubspotSettings = async () => {
    setLoadingHubspot(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/hubspot-settings`);
      if (res.ok) {
        const data = await res.json();
        setHubspotEnabled(data.enabled || false);
        setHubspotHasToken(data.hasAccessToken || false);
        setHubspotLastSync(data.lastSync || null);
        setHubspotSyncCount(data.syncCount || 0);
      }
    } catch (error) {
      console.error("Error fetching HubSpot settings:", error);
    } finally {
      setLoadingHubspot(false);
    }
  };

  const saveHubspotSettings = async () => {
    setSavingHubspot(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/hubspot-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: hubspotEnabled,
          accessToken: hubspotAccessToken || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || "HubSpot settings saved");
        setHubspotAccessToken(""); // Clear the input after saving
        fetchHubspotSettings(); // Refresh settings
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save HubSpot settings");
      }
    } catch (error) {
      console.error("Error saving HubSpot settings:", error);
      setError("Failed to save HubSpot settings");
    } finally {
      setSavingHubspot(false);
    }
  };

  const disconnectHubspot = async () => {
    if (!confirm("Are you sure you want to disconnect HubSpot? This will stop syncing positive replies.")) {
      return;
    }

    setDisconnectingHubspot(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/hubspot-settings`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHubspotEnabled(false);
        setHubspotHasToken(false);
        setHubspotLastSync(null);
        setHubspotSyncCount(0);
        setSuccess("HubSpot disconnected");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to disconnect HubSpot");
      }
    } catch (error) {
      console.error("Error disconnecting HubSpot:", error);
      setError("Failed to disconnect HubSpot");
    } finally {
      setDisconnectingHubspot(false);
    }
  };

  const testHubspotSync = async () => {
    setTestingHubspot(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/test-hubspot`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(data.message || "Test contact synced to HubSpot!");
        fetchHubspotSettings(); // Refresh to show updated count
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || "Failed to sync test contact");
      }
    } catch (error) {
      console.error("Error testing HubSpot sync:", error);
      setError("Failed to test HubSpot sync");
    } finally {
      setTestingHubspot(false);
    }
  };

  useEffect(() => {
    fetchClient();
    fetchTeamMembers();
    fetchNotificationPreferences();
    fetchStatsSettings();
    fetchHubspotSettings();
  }, [clientId]);

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setClientUsers(data.users || []);
        setPendingInvitations(data.pendingInvitations || []);
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  };

  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLink(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: "owner" }),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteSuccess(data.message || "Invitation created!");
        setInviteEmail("");
        fetchTeamMembers();

        // Only show manual link if email wasn't sent successfully
        if (data.loginUrl && !data.emailSent) {
          setInviteLink(data.loginUrl);
        } else {
          // Email was sent, just show success message briefly
          setTimeout(() => setInviteSuccess(null), 5000);
        }
      } else {
        setInviteError(data.error || "Failed to send invitation");
      }
    } catch (err) {
      setInviteError("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setInviteSuccess("Link copied to clipboard!");
      setTimeout(() => {
        setInviteSuccess(null);
      }, 3000);
    }
  };

  const dismissInviteLink = () => {
    setInviteLink(null);
    setInviteSuccess(null);
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Remove this user from the client?")) return;

    setRemovingUserId(userId);
    try {
      const res = await fetch(`/api/clients/${clientId}/invitations?userId=${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchTeamMembers();
      }
    } catch (err) {
      console.error("Failed to remove user:", err);
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/invitations?invitationId=${invitationId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchTeamMembers();
      }
    } catch (err) {
      console.error("Failed to cancel invitation:", err);
    }
  };

  const fetchClient = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        const clientData = data.client;
        setClient(clientData);
        setName(clientData.name || "");
        setWebsite(clientData.website || "");
        setNotes(clientData.notes || "");
        if (clientData.logo_url) {
          setLogoPreview(clientData.logo_url);
        }
        // Load Client Intelligence fields
        setProductService(clientData.product_service || "");
        setIcp(clientData.icp || "");
        setAcv(clientData.acv ? String(clientData.acv) : "");
        setTcv(clientData.tcv ? String(clientData.tcv) : "");
        setVerticals(clientData.verticals ? clientData.verticals.join(", ") : "");
        setTam(clientData.tam ? String(clientData.tam) : "");
        setTargetDailyEmails(clientData.target_daily_emails ? String(clientData.target_daily_emails) : "");
      } else {
        setError("Failed to load client");
      }
    } catch (err) {
      setError("Failed to load client");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);

      const res = await fetch(`/api/clients/${clientId}/logo`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setLogoPreview(data.url);
        setLogoFile(null);
        setSuccess("Logo uploaded successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to upload logo");
      }
    } catch (err) {
      setError("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm("Remove the client logo?")) return;

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: null }),
      });

      if (res.ok) {
        setLogoPreview(null);
        setSuccess("Logo removed");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError("Failed to remove logo");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Parse verticals from comma-separated string
      const verticalsArray = verticals
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || null,
          notes: notes.trim() || null,
          product_service: productService.trim() || null,
          icp: icp.trim() || null,
          acv: acv ? parseFloat(acv) : null,
          tcv: tcv ? parseFloat(tcv) : null,
          verticals: verticalsArray.length > 0 ? verticalsArray : null,
          tam: tam ? parseInt(tam, 10) : null,
          target_daily_emails: targetDailyEmails ? parseInt(targetDailyEmails, 10) : null,
        }),
      });

      if (res.ok) {
        setSuccess("Settings saved successfully");
        setTimeout(() => setSuccess(null), 3000);
        fetchClient();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Client not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {client.name}
        </Link>
        <h1 className="text-2xl font-bold">Client Settings</h1>
        <p className="text-muted-foreground">Configure settings for {client.name}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Client Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Client Logo</CardTitle>
          <CardDescription>
            Upload a logo for this client to display in their dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Client logo"
                  width={96}
                  height={96}
                  className="object-contain w-full h-full"
                  unoptimized={logoPreview.startsWith("data:")}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoChange}
                accept="image/*"
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </Button>
                {logoFile && (
                  <Button onClick={handleLogoUpload} disabled={uploadingLogo}>
                    {uploadingLogo ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                )}
                {logoPreview && !logoFile && (
                  <Button variant="outline" onClick={handleRemoveLogo}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: 200x200px, PNG or JPG
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Details */}
      <Card>
        <CardHeader>
          <CardTitle>Client Details</CardTitle>
          <CardDescription>
            Basic information about this client
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Client Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter client name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this client..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle>Client Intelligence</CardTitle>
          <CardDescription>
            Business details for campaign planning and email recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productService">The Offer (Product/Service)</Label>
            <Textarea
              id="productService"
              value={productService}
              onChange={(e) => setProductService(e.target.value)}
              placeholder="Describe what you're offering - the core value proposition..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">What problem does this solve? What&apos;s the main benefit?</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="icp">Ideal Customer Profile (ICP)</Label>
            <Textarea
              id="icp"
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              placeholder="e.g., B2B SaaS companies with 50-500 employees, Series A-C funded, in the US/EU, looking to scale their sales team..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">Describe the ideal target customer: company size, industry, geography, pain points, etc.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acv">ACV (Annual Contract Value)</Label>
              <Input
                id="acv"
                type="number"
                value={acv}
                onChange={(e) => setAcv(e.target.value)}
                placeholder="e.g., 50000"
              />
              <p className="text-xs text-muted-foreground">Average annual value per deal</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tcv">TCV (Total Contract Value)</Label>
              <Input
                id="tcv"
                type="number"
                value={tcv}
                onChange={(e) => setTcv(e.target.value)}
                placeholder="e.g., 150000"
              />
              <p className="text-xs text-muted-foreground">Total value over contract lifetime</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verticals">Target Verticals</Label>
            <Input
              id="verticals"
              value={verticals}
              onChange={(e) => setVerticals(e.target.value)}
              placeholder="e.g., SaaS, Healthcare, FinTech"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of industries</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tam">TAM (Total Addressable Market)</Label>
              <Input
                id="tam"
                type="number"
                value={tam}
                onChange={(e) => setTam(e.target.value)}
                placeholder="e.g., 5000"
              />
              <p className="text-xs text-muted-foreground">Total number of potential leads</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetDailyEmails">Target Daily Emails</Label>
              <Input
                id="targetDailyEmails"
                type="number"
                value={targetDailyEmails}
                onChange={(e) => setTargetDailyEmails(e.target.value)}
                placeholder="e.g., 100"
              />
              <p className="text-xs text-muted-foreground">Recommended daily send volume</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Access
          </CardTitle>
          <CardDescription>
            Invite client owners to access their dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Form */}
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  disabled={inviting}
                />
              </div>
              <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Invite
              </Button>
            </div>

            {inviteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <Check className="h-4 w-4" />
                {inviteSuccess}
              </div>
            )}

            {inviteLink && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Manual invite required</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Automated emails are not configured yet. Please copy this link and send it manually via email, Slack, or any messaging app.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={dismissInviteLink}
                    className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 -mr-2 -mt-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs bg-white font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyInviteLink}
                    className="shrink-0 border-amber-300 hover:bg-amber-100"
                  >
                    Copy Link
                  </Button>
                </div>
              </div>
            )}
          </form>

          {/* Current Team Members */}
          {clientUsers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Active Members</h4>
              <div className="space-y-2">
                {clientUsers.map((cu) => (
                  <div
                    key={cu.user_id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {cu.profiles?.email?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {cu.profiles?.full_name || cu.profiles?.email || "Unknown"}
                        </p>
                        {cu.profiles?.full_name && cu.profiles?.email && (
                          <p className="text-xs text-muted-foreground">{cu.profiles.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{cu.role || "owner"}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveUser(cu.user_id)}
                        disabled={removingUserId === cu.user_id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        {removingUserId === cu.user_id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Pending Invitations</h4>
              <div className="space-y-2">
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(inv.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Pending
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelInvitation(inv.id)}
                        className="text-muted-foreground hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clientUsers.length === 0 && pendingInvitations.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members yet</p>
              <p className="text-xs mt-1">Invite client owners to give them access to their dashboard</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Positive Reply Notifications
          </CardTitle>
          <CardDescription>
            Choose who receives email notifications when this client gets a positive reply
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingNotifications ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notificationUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No workspace users found</p>
          ) : (
            <div className="space-y-3">
              {notificationUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                      {user.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {togglingUser === user.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={user.notificationsEnabled}
                        onCheckedChange={(checked: boolean) => toggleNotification(user.id, checked)}
                      />
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                Enabled users will receive an email when a positive reply is detected for {client.name}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Report Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Stats Reports
          </CardTitle>
          <CardDescription>
            Automatically send periodic stats reports to the notification recipients above
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatsSettings ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="statsInterval">Report Frequency</Label>
                <Select
                  value={statsReportInterval}
                  onValueChange={saveStatsInterval}
                  disabled={savingStatsSettings}
                >
                  <SelectTrigger id="statsInterval" className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reports include emails sent, total replies, and positive replies for the selected period.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm font-medium">Send Test Report</p>
                  <p className="text-xs text-muted-foreground">
                    Send a stats report now to all notification recipients
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendTestReport}
                  disabled={sendingTestReport || notificationUsers.filter(u => u.notificationsEnabled).length === 0}
                >
                  {sendingTestReport ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Now
                </Button>
              </div>
              {notificationUsers.filter(u => u.notificationsEnabled).length === 0 && (
                <p className="text-xs text-amber-600">
                  Enable at least one notification recipient above to receive stats reports.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* HubSpot CRM Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            CRM Integration
          </CardTitle>
          <CardDescription>
            Automatically sync positive replies to your CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingHubspot ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* HubSpot Connection Status */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${hubspotHasToken ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                    <svg className={`h-5 w-5 ${hubspotHasToken ? "text-green-600" : "text-gray-500"}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984 2.21 2.21 0 00-4.42 0c0 .873.514 1.626 1.254 1.984v2.846c-.87.162-1.64.549-2.255 1.114l-7.12-5.548a2.206 2.206 0 00-4.678 1.004 2.2 2.2 0 001.947 2.185v5.63A2.2 2.2 0 002.212 14.5a2.21 2.21 0 004.42 0c0-.685-.321-1.3-.82-1.699v-5.63a2.19 2.19 0 00.82-3.099l7.12 5.548a3.631 3.631 0 00-.487 1.816 3.65 3.65 0 003.645 3.646 3.65 3.65 0 003.645-3.646 3.646 3.646 0 00-2.39-3.436z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm">HubSpot CRM</p>
                    <p className="text-xs text-muted-foreground">
                      {hubspotHasToken ? (
                        hubspotEnabled ? (
                          <span className="text-green-600">Connected and syncing</span>
                        ) : (
                          <span className="text-amber-600">Connected but disabled</span>
                        )
                      ) : (
                        "Not connected"
                      )}
                    </p>
                  </div>
                </div>
                {hubspotHasToken && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={hubspotEnabled}
                      onCheckedChange={async (checked) => {
                        setHubspotEnabled(checked);
                        // Auto-save when toggling
                        setSavingHubspot(true);
                        try {
                          const res = await fetch(`/api/clients/${clientId}/hubspot-settings`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ enabled: checked }),
                          });
                          if (res.ok) {
                            setSuccess(checked ? "HubSpot sync enabled" : "HubSpot sync disabled");
                            setTimeout(() => setSuccess(null), 3000);
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setSavingHubspot(false);
                        }
                      }}
                      disabled={savingHubspot}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={disconnectHubspot}
                      disabled={disconnectingHubspot}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      {disconnectingHubspot ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Connection Form or Stats */}
              {hubspotHasToken ? (
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Contacts synced:</span>
                      <span className="font-medium text-foreground">{hubspotSyncCount}</span>
                    </div>
                    {hubspotLastSync && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Last sync:</span>
                        <span className="font-medium text-foreground">
                          {new Date(hubspotLastSync).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-2">
                      Positive replies are automatically synced to HubSpot as contacts with the email thread attached.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-sm font-medium">Test Sync</p>
                      <p className="text-xs text-muted-foreground">
                        Send a test contact to HubSpot to verify the integration
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testHubspotSync}
                      disabled={testingHubspot || !hubspotEnabled}
                    >
                      {testingHubspot ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Test Now
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="hubspotToken">HubSpot Private App Token</Label>
                    <Input
                      id="hubspotToken"
                      type="password"
                      value={hubspotAccessToken}
                      onChange={(e) => setHubspotAccessToken(e.target.value)}
                      placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Create a Private App in HubSpot with scopes: <code className="bg-muted px-1 rounded">crm.objects.contacts.read</code>, <code className="bg-muted px-1 rounded">crm.objects.contacts.write</code>, <code className="bg-muted px-1 rounded">crm.objects.notes.write</code>
                    </p>
                  </div>
                  <Button
                    onClick={saveHubspotSettings}
                    disabled={savingHubspot || !hubspotAccessToken}
                  >
                    {savingHubspot ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Connect HubSpot
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
