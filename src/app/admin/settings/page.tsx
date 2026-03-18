"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Check, RefreshCw, Eye, EyeOff, Upload, ArrowLeft, Image as ImageIcon, Building2, Palette, Mail, Globe, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Setting {
  key: string;
  is_set: boolean;
  is_encrypted: boolean;
  updated_at: string;
  masked_value: string;
}

interface Agency {
  id: string;
  email: string;
  name: string;
  clientCount: number;
  createdAt: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState(false);

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Branding state
  const [agencyName, setAgencyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);

  // Agency owners state (platform admin only)
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [viewingAs, setViewingAs] = useState<string | null>(null);
  const [deletingAgency, setDeletingAgency] = useState<string | null>(null);


  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings || []);

      // Load branding settings
      const allSettings = data.settings || [];
      const logoSetting = allSettings.find((s: Setting) => s.key === "agency_logo_url");
      const nameSetting = allSettings.find((s: Setting) => s.key === "agency_name");
      const colorSetting = allSettings.find((s: Setting) => s.key === "agency_primary_color");
      const senderNameSetting = allSettings.find((s: Setting) => s.key === "agency_sender_name");
      const senderEmailSetting = allSettings.find((s: Setting) => s.key === "agency_sender_email");

      if (logoSetting?.is_set) {
        setLogoUrl(logoSetting.masked_value);
        setLogoPreview(logoSetting.masked_value);
      }
      if (nameSetting?.is_set) setAgencyName(nameSetting.masked_value);
      if (colorSetting?.is_set) setPrimaryColor(colorSetting.masked_value);
      if (senderNameSetting?.is_set) setSenderName(senderNameSetting.masked_value);
      if (senderEmailSetting?.is_set) setSenderEmail(senderEmailSetting.masked_value);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveBrandingSettings = async () => {
    setSavingBranding(true);
    try {
      const updates = [
        { key: "agency_name", value: agencyName },
        { key: "agency_primary_color", value: primaryColor },
        { key: "agency_sender_name", value: senderName },
        { key: "agency_sender_email", value: senderEmail },
      ];

      for (const update of updates) {
        await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
      }

      await fetchSettings();
    } catch (error) {
      console.error("Error saving branding:", error);
    } finally {
      setSavingBranding(false);
    }
  };

  const fetchAgencies = async () => {
    setLoadingAgencies(true);
    try {
      const res = await fetch("/api/admin/agencies");
      if (res.ok) {
        const data = await res.json();
        setAgencies(data.agencies || []);
        setIsPlatformAdmin(true);
      } else if (res.status === 403) {
        // Not a platform admin, that's fine
        setIsPlatformAdmin(false);
      }
    } catch (error) {
      console.error("Error fetching agencies:", error);
    } finally {
      setLoadingAgencies(false);
    }
  };

  const handleDeleteAgency = async (agency: Agency) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${agency.name || agency.email}?\n\nThis will permanently delete:\n- Their profile and auth account\n- ${agency.clientCount} client(s) and all associated data\n- All campaigns, leads, and emails\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    // Double confirm for safety
    const doubleConfirm = window.confirm(
      `FINAL CONFIRMATION: Delete ${agency.name || agency.email} and ALL their data permanently?`
    );
    if (!doubleConfirm) return;

    setDeletingAgency(agency.id);
    try {
      const res = await fetch("/api/admin/agencies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: agency.id }),
      });
      if (res.ok) {
        setAgencies((prev) => prev.filter((a) => a.id !== agency.id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete agency");
      }
    } catch (error) {
      console.error("Error deleting agency:", error);
      alert("Failed to delete agency");
    } finally {
      setDeletingAgency(null);
    }
  };

  const handleViewDashboard = async (ownerId: string) => {
    setViewingAs(ownerId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId }),
      });
      if (res.ok) {
        window.location.href = "/admin";
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start impersonation");
        setViewingAs(null);
      }
    } catch (error) {
      console.error("Error starting impersonation:", error);
      setViewingAs(null);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchAgencies();
  }, []);

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
    try {
      const formData = new FormData();
      formData.append("file", logoFile);

      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.url);
        setLogoPreview(data.url);
        setLogoFile(null);
        await fetchSettings();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to upload logo");
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      alert("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValue }),
      });

      if (res.ok) {
        setEditingKey(null);
        setEditValue("");
        await fetchSettings();
      }
    } catch (error) {
      console.error("Error saving setting:", error);
    } finally {
      setSaving(null);
    }
  };

  const handleClear = async (key: string) => {
    if (!confirm("Are you sure you want to clear this setting?")) return;

    setSaving(key);
    try {
      const res = await fetch(`/api/admin/settings?key=${key}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchSettings();
      }
    } catch (error) {
      console.error("Error clearing setting:", error);
    } finally {
      setSaving(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Command Center
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-gray-500">Configure your agency branding and integrations</p>
      </div>

      {/* Agency Owners (platform admin only) */}
      {isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Agency Owners
            </CardTitle>
            <CardDescription>
              View and manage agency owners on the platform. Click &quot;View Dashboard&quot; to see
              the platform as that agency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAgencies ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : agencies.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No other agency owners yet</p>
            ) : (
              <div className="space-y-3">
                {agencies.map((agency) => (
                  <div
                    key={agency.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg border bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {agency.name || agency.email}
                        </p>
                        <p className="text-sm text-muted-foreground">{agency.email}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {agency.clientCount} {agency.clientCount === 1 ? "client" : "clients"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {agency.createdAt ? `Joined ${new Date(agency.createdAt).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDashboard(agency.id)}
                        disabled={viewingAs === agency.id}
                      >
                        {viewingAs === agency.id ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        View Dashboard
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAgency(agency)}
                        disabled={deletingAgency === agency.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 border-red-200 dark:border-red-800"
                      >
                        {deletingAgency === agency.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Agency Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Agency Logo
          </CardTitle>
          <CardDescription>
            Upload your agency logo to display in the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Agency logo"
                  width={96}
                  height={96}
                  className="object-contain w-full h-full"
                  unoptimized={logoPreview.startsWith("data:")}
                />
              ) : (
                <Upload className="h-8 w-8 text-gray-400" />
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
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: 200x200px, PNG or JPG
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Agency Branding
          </CardTitle>
          <CardDescription>
            Customize your agency name and colors for client communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agencyName">Agency Name</Label>
              <Input
                id="agencyName"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="BlueReach Agency"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Primary Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <Label className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4" />
              Email Sender Settings
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="BlueReach Team"
                />
                <p className="text-xs text-muted-foreground">
                  This name appears as the &quot;From&quot; in emails
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Sender Email</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="hello@bluereach.com"
                />
                <p className="text-xs text-muted-foreground">
                  Must be verified in Resend
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={saveBrandingSettings} disabled={savingBranding}>
              {savingBranding ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Branding Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Service (Resend)
          </CardTitle>
          <CardDescription>
            Configure Resend API key to send invitation emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const resendSetting = settings.find(s => s.key === "resend_api_key");
            const isEditing = editingKey === "resend_api_key";

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-500" />
                    Resend API Key
                    {resendSetting?.is_set ? (
                      <Badge variant="default" className="ml-2">Configured</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">Not Set</Badge>
                    )}
                  </Label>
                </div>
                <p className="text-sm text-gray-500">
                  Get your API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a>
                </p>

                {isEditing ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showValue ? "text" : "password"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="re_..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowValue(!showValue)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      onClick={() => handleSave("resend_api_key")}
                      disabled={saving === "resend_api_key"}
                    >
                      {saving === "resend_api_key" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingKey(null);
                        setEditValue("");
                        setShowValue(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={resendSetting?.is_set ? resendSetting.masked_value : ""}
                      disabled
                      placeholder="Not configured"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingKey("resend_api_key");
                        setEditValue("");
                      }}
                    >
                      {resendSetting?.is_set ? "Change" : "Set"}
                    </Button>
                    {resendSetting?.is_set && (
                      <Button
                        variant="outline"
                        onClick={() => handleClear("resend_api_key")}
                        disabled={saving === "resend_api_key"}
                        className="text-red-600 hover:text-red-700"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>


    </div>
  );
}
