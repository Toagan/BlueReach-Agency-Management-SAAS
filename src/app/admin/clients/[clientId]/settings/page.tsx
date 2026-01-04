"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Save, Check, AlertCircle, RefreshCw, Trash2, UserPlus, Mail, X, Users } from "lucide-react";
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

  useEffect(() => {
    fetchClient();
    fetchTeamMembers();
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

        // If email wasn't sent, show the login link
        if (data.loginUrl) {
          setInviteLink(data.loginUrl);
        } else {
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
                        className="text-muted-foreground hover:text-red-600"
                      >
                        {removingUserId === cu.user_id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
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
