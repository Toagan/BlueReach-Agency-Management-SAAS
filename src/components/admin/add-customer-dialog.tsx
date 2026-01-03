"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "name" | "instantly" | "webhook" | "invite" | "complete";

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
  const [step, setStep] = useState<Step>("name");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [instantlyApiKey, setInstantlyApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Generated webhook URL
  const [webhookUrl, setWebhookUrl] = useState("");

  const resetForm = () => {
    setStep("name");
    setCustomerName("");
    setInstantlyApiKey("");
    setShowApiKey(false);
    setApiKeyValid(null);
    setWebhookSecret("");
    setClientFirstName("");
    setClientEmail("");
    setWebhookUrl("");
    setError(null);
    setCreatedCustomerId(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateApiKey = async () => {
    if (!instantlyApiKey.trim()) {
      setApiKeyValid(false);
      return;
    }

    setValidatingKey(true);
    try {
      const res = await fetch("/api/instantly/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: instantlyApiKey }),
      });

      const data = await res.json();
      setApiKeyValid(data.valid === true);
    } catch {
      setApiKeyValid(false);
    } finally {
      setValidatingKey(false);
    }
  };

  const generateWebhookSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let secret = "";
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWebhookSecret(secret);
  };

  const handleCreateCustomer = async () => {
    if (!customerName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName.trim(),
          instantly_api_key: instantlyApiKey.trim() || null,
          webhook_secret: webhookSecret.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create customer");
      }

      const data = await res.json();
      const customerId = data.client?.id || data.customer?.id || data.id;
      setCreatedCustomerId(customerId);

      // Generate webhook URL
      const baseUrl = window.location.origin;
      setWebhookUrl(`${baseUrl}/api/webhooks/instantly/${customerId}`);

      // Send invitation if email provided
      if (clientEmail.trim()) {
        try {
          await fetch("/api/admin/invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: customerId,
              email: clientEmail.trim(),
              first_name: clientFirstName.trim() || null,
            }),
          });
        } catch (inviteErr) {
          console.error("Failed to send invitation:", inviteErr);
          // Don't fail the whole flow if invitation fails
        }
      }

      setStep("complete");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderStep = () => {
    switch (step) {
      case "name":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                placeholder="e.g., Acme Corporation"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                The company or brand name for this customer.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("instantly")}
                disabled={!customerName.trim()}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "instantly":
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                How to get an Instantly API Key
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
                <li>
                  Log in to{" "}
                  <a
                    href="https://app.instantly.ai/app/settings/integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    Instantly Settings <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Go to <strong>Settings → Integrations → API</strong></li>
                <li>Click <strong>Create New API Key</strong></li>
                <li>Give it a name (e.g., &quot;{customerName} Portal&quot;)</li>
                <li>Select these permissions:
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">campaigns:read</code> - View campaigns</li>
                    <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">leads:read</code> - View leads</li>
                    <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">leads:write</code> - Update lead status</li>
                    <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">analytics:read</code> - View analytics</li>
                  </ul>
                </li>
                <li>Copy the API key and paste it below</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Instantly API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter API key..."
                    value={instantlyApiKey}
                    onChange={(e) => {
                      setInstantlyApiKey(e.target.value);
                      setApiKeyValid(null);
                    }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={validateApiKey}
                  disabled={validatingKey || !instantlyApiKey.trim()}
                >
                  {validatingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Validate"
                  )}
                </Button>
              </div>
              {apiKeyValid === true && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> API key is valid
                </p>
              )}
              {apiKeyValid === false && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Invalid API key
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Optional: Skip this step if you want to configure it later.
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("name")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep("webhook")}>
                  Skip
                </Button>
                <Button onClick={() => setStep("webhook")}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "webhook":
        return (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                Webhook Configuration (Optional)
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                Webhooks allow Instantly to send real-time updates when leads reply,
                open emails, or change status. This keeps your portal data in sync.
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> You can configure webhooks after creating the customer.
                The webhook URL will be generated automatically.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="webhookSecret">Webhook Secret</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateWebhookSecret}
                >
                  Generate
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  id="webhookSecret"
                  placeholder="Optional webhook secret for signature verification"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
                {webhookSecret && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookSecret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Used to verify webhook requests from Instantly.
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("instantly")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep("invite")}>
                  Skip
                </Button>
                <Button onClick={() => setStep("invite")}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "invite":
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Invite Client to Dashboard
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Send an email invitation to give your client access to their dashboard.
                They will sign in using Google authentication.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientFirstName">Client First Name</Label>
              <Input
                id="clientFirstName"
                placeholder="e.g., John"
                value={clientFirstName}
                onChange={(e) => setClientFirstName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email Address</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g., john@acme.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                An invitation will be sent to this email with a link to access the dashboard.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("webhook")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleCreateCustomer} disabled={isCreating}>
                  Skip & Create
                </Button>
                <Button onClick={handleCreateCustomer} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create & Send Invite
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold">Customer Created!</h3>
              <p className="text-muted-foreground">
                {customerName} has been set up successfully.
              </p>
              {clientEmail && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Invitation sent to {clientEmail}
                </p>
              )}
            </div>

            {webhookUrl && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <div className="flex gap-2 mt-1">
                    <code className="flex-1 text-xs bg-background p-2 rounded border break-all">
                      {webhookUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Next Steps
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Go to Instantly → Settings → Webhooks</li>
                <li>Add a new webhook with the URL above</li>
                <li>Select events: reply_received, lead_interested, email_sent</li>
                <li>Link campaigns to this customer from their dashboard</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = `/admin/clients/${createdCustomerId}`;
                }}
              >
                Go to Customer
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
    }
  };

  const stepTitles: Record<Step, string> = {
    name: "Customer Details",
    instantly: "Instantly API Setup",
    webhook: "Webhook Configuration",
    invite: "Client Access",
    complete: "Setup Complete",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          {step !== "complete" && (
            <div className="flex items-center gap-2 pt-2">
              {(["name", "instantly", "webhook", "invite"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${
                    (["name", "instantly", "webhook", "invite"] as Step[]).indexOf(step) >= i
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>
        <div className="pt-4">{renderStep()}</div>
      </DialogContent>
    </Dialog>
  );
}
