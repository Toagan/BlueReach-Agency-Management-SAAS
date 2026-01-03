"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Shield, Check, X, RefreshCw, Eye, EyeOff, Upload, ArrowLeft, Image as ImageIcon, Building2, Palette, Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Setting {
  key: string;
  is_set: boolean;
  is_encrypted: boolean;
  updated_at: string;
  masked_value: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"success" | "error" | null>(null);

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

  useEffect(() => {
    fetchSettings();
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

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch("/api/instantly/status");
      const data = await res.json();
      setConnectionStatus(data.connected ? "success" : "error");
    } catch {
      setConnectionStatus("error");
    } finally {
      setTestingConnection(false);
    }
  };

  const settingLabels: Record<string, { label: string; description: string; icon: typeof Key }> = {
    instantly_api_key: {
      label: "Instantly API Key",
      description: "Your Instantly.ai API key for syncing campaigns and leads",
      icon: Key,
    },
    instantly_webhook_secret: {
      label: "Instantly Webhook Secret",
      description: "Secret for validating incoming webhooks from Instantly",
      icon: Shield,
    },
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

      {/* Instantly Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Instantly Integration</CardTitle>
              <CardDescription>
                Connect your Instantly.ai account to sync campaigns and leads
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testingConnection}
            >
              {testingConnection ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : connectionStatus === "success" ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : connectionStatus === "error" ? (
                <X className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.map((setting) => {
            const config = settingLabels[setting.key] || {
              label: setting.key,
              description: "",
              icon: Key,
            };
            const Icon = config.icon;
            const isEditing = editingKey === setting.key;

            return (
              <div key={setting.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    {config.label}
                    {setting.is_set ? (
                      <Badge variant="default" className="ml-2">Configured</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">Not Set</Badge>
                    )}
                  </Label>
                </div>
                <p className="text-sm text-gray-500">{config.description}</p>

                {isEditing ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showValue ? "text" : "password"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Enter new value..."
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
                      onClick={() => handleSave(setting.key)}
                      disabled={saving === setting.key}
                    >
                      {saving === setting.key ? (
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
                      value={setting.is_set ? setting.masked_value : ""}
                      disabled
                      placeholder="Not configured"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingKey(setting.key);
                        setEditValue("");
                      }}
                    >
                      {setting.is_set ? "Change" : "Set"}
                    </Button>
                    {setting.is_set && (
                      <Button
                        variant="outline"
                        onClick={() => handleClear(setting.key)}
                        disabled={saving === setting.key}
                        className="text-red-600 hover:text-red-700"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}

                {setting.updated_at && setting.is_set && (
                  <p className="text-xs text-gray-400">
                    Last updated: {new Date(setting.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>How to get your Instantly API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Log in to your Instantly.ai dashboard</li>
            <li>Go to <strong>Settings</strong> → <strong>Integrations</strong> → <strong>API</strong></li>
            <li>Click <strong>Create API Key</strong></li>
            <li>Copy the key and paste it above</li>
          </ol>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Your API key is stored securely and encrypted.
              It will only be used to sync data between Instantly and this dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
