"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Shield, Check, X, RefreshCw, Eye, EyeOff } from "lucide-react";

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

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings || []);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-gray-500">Configure your integrations and API keys</p>
      </div>

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
