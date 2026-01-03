"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

type ProviderType = "instantly" | "smartlead";

interface ProviderCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "draft" | "completed";
  leadsCount?: number;
}

interface AddCampaignDialogProps {
  clientId: string;
}

const PROVIDERS: { value: ProviderType; label: string; available: boolean }[] = [
  { value: "instantly", label: "Instantly", available: true },
  { value: "smartlead", label: "Smartlead", available: true },
];

export function AddCampaignDialog({ clientId }: AddCampaignDialogProps) {
  // Dialog state
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"provider" | "campaign" | "success">("provider");

  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("instantly");

  // API key
  const [apiKey, setApiKey] = useState("");
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState<ProviderCampaign[]>([]);
  const [linkedCampaignIds, setLinkedCampaignIds] = useState<Set<string>>(new Set());
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [customName, setCustomName] = useState("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Submission
  const [isPending, startTransition] = useTransition();
  const [linkedCampaignName, setLinkedCampaignName] = useState("");
  const [copied, setCopied] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Generate webhook URL
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/${selectedProvider}`
      : "";

  // Validate API key
  const validateApiKey = async () => {
    if (!apiKey.trim()) return;

    setValidatingKey(true);
    setApiKeyValid(null);

    try {
      const res = await fetch(`/api/providers/${selectedProvider}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      setApiKeyValid(data.valid);
    } catch (error) {
      console.error("Error validating API key:", error);
      setApiKeyValid(false);
    } finally {
      setValidatingKey(false);
    }
  };

  // Fetch campaigns from provider
  const fetchCampaigns = async () => {
    if (!apiKey.trim() || !apiKeyValid) return;

    setLoadingCampaigns(true);
    try {
      const res = await fetch(`/api/providers/${selectedProvider}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      setCampaigns(data.campaigns || []);

      // Fetch already linked campaigns
      const { data: linked } = await supabase
        .from("campaigns")
        .select("provider_campaign_id, instantly_campaign_id")
        .eq("provider_type", selectedProvider);

      const linkedIds = new Set<string>();
      (linked || []).forEach((c) => {
        if (c.provider_campaign_id) linkedIds.add(c.provider_campaign_id);
        if (c.instantly_campaign_id) linkedIds.add(c.instantly_campaign_id);
      });
      setLinkedCampaignIds(linkedIds);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // When API key becomes valid, fetch campaigns
  useEffect(() => {
    if (apiKeyValid === true) {
      fetchCampaigns();
    }
  }, [apiKeyValid]);

  // Reset state when provider changes
  useEffect(() => {
    setApiKey("");
    setApiKeyValid(null);
    setCampaigns([]);
    setSelectedCampaignId("");
  }, [selectedProvider]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const availableCampaigns = campaigns.filter((c) => !linkedCampaignIds.has(c.id));

  const handleContinueToSelect = () => {
    if (apiKeyValid && campaigns.length > 0) {
      setStep("campaign");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCampaignId || !apiKey.trim()) return;

    const campaignName = customName.trim() || selectedCampaign?.name || "Unnamed Campaign";

    const { error } = await supabase.from("campaigns").insert({
      client_id: clientId,
      name: campaignName,
      original_name: selectedCampaign?.name,
      provider_type: selectedProvider,
      provider_campaign_id: selectedCampaignId,
      // For backwards compatibility
      instantly_campaign_id: selectedProvider === "instantly" ? selectedCampaignId : null,
      api_key_encrypted: apiKey.trim(), // Store the API key
      is_active: selectedCampaign?.status === "active",
    });

    if (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to link campaign: " + error.message);
      return;
    }

    // Show success with webhook URL
    setLinkedCampaignName(campaignName);
    setStep("success");

    startTransition(() => {
      router.refresh();
    });
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after animation
    setTimeout(() => {
      setStep("provider");
      setSelectedProvider("instantly");
      setApiKey("");
      setApiKeyValid(null);
      setCampaigns([]);
      setSelectedCampaignId("");
      setCustomName("");
      setCopied(false);
    }, 200);
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getProviderSettingsUrl = () => {
    switch (selectedProvider) {
      case "instantly":
        return "https://app.instantly.ai/app/settings/integrations";
      case "smartlead":
        return "https://app.smartlead.ai/settings/integrations";
      default:
        return "#";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>Link Campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {step === "success" ? (
          // Success state with webhook URL
          <>
            <DialogHeader>
              <DialogTitle className="text-green-600">Campaign Linked!</DialogTitle>
              <DialogDescription>
                <strong>{linkedCampaignName}</strong> has been linked successfully.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">
                  Set up Webhook in {selectedProvider === "instantly" ? "Instantly" : "Smartlead"}
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  To receive real-time updates (opens, clicks, replies), add this webhook URL in your{" "}
                  {selectedProvider === "instantly" ? "Instantly" : "Smartlead"} campaign settings:
                </p>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="bg-white text-sm font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Webhook Events to Enable</h4>
                {selectedProvider === "instantly" ? (
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>
                      - <strong>reply_received</strong> - When lead replies
                    </li>
                    <li>
                      - <strong>lead_interested</strong> - Positive reply detected
                    </li>
                    <li>
                      - <strong>email_opened</strong> - When email is opened
                    </li>
                    <li>
                      - <strong>link_clicked</strong> - When link is clicked
                    </li>
                    <li>
                      - <strong>email_sent</strong> - When email is sent
                    </li>
                  </ul>
                ) : (
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>
                      - <strong>EMAIL_REPLY</strong> - When lead replies
                    </li>
                    <li>
                      - <strong>LEAD_CATEGORY_UPDATED</strong> - Interest status changes
                    </li>
                    <li>
                      - <strong>EMAIL_OPEN</strong> - When email is opened
                    </li>
                    <li>
                      - <strong>EMAIL_LINK_CLICK</strong> - When link is clicked
                    </li>
                    <li>
                      - <strong>EMAIL_SENT</strong> - When email is sent
                    </li>
                    <li>
                      - <strong>LEAD_UNSUBSCRIBED</strong> - When lead unsubscribes
                    </li>
                  </ul>
                )}
              </div>

              <a
                href={getProviderSettingsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Open {selectedProvider === "instantly" ? "Instantly" : "Smartlead"} Webhook Settings
              </a>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : step === "campaign" ? (
          // Campaign selection
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Select Campaign</DialogTitle>
              <DialogDescription>
                Choose a campaign from {selectedProvider === "instantly" ? "Instantly" : "Smartlead"} to
                link to this client.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : availableCampaigns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No unlinked campaigns available.</p>
                  <p className="text-sm mt-1">All campaigns from this API key are already linked.</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="campaign">Select Campaign *</Label>
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a campaign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCampaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  campaign.status === "active" ? "bg-green-500" : "bg-gray-400"
                                }`}
                              />
                              {campaign.name}
                              {campaign.leadsCount !== undefined && (
                                <span className="text-gray-400 text-xs">({campaign.leadsCount} leads)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCampaign && (
                    <div>
                      <Label htmlFor="customName">Display Name (Optional)</Label>
                      <Input
                        id="customName"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder={selectedCampaign.name}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to use the original campaign name
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("provider")}>
                Back
              </Button>
              <Button type="submit" disabled={isPending || !selectedCampaignId || loadingCampaigns}>
                {isPending ? "Linking..." : "Link Campaign"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // Provider and API key selection
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleContinueToSelect();
            }}
          >
            <DialogHeader>
              <DialogTitle>Link Campaign</DialogTitle>
              <DialogDescription>
                Select your email provider and enter the API key for the campaign.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Provider Selection */}
              <div>
                <Label>Email Provider</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider.value}
                      type="button"
                      disabled={!provider.available}
                      onClick={() => setSelectedProvider(provider.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedProvider === provider.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : provider.available
                          ? "border-gray-200 hover:border-gray-300"
                          : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <div className="font-medium">{provider.label}</div>
                      {!provider.available && <div className="text-xs">Coming soon</div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Input */}
              <div>
                <Label htmlFor="apiKey">API Key *</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setApiKeyValid(null);
                      }}
                      placeholder={`Enter your ${
                        selectedProvider === "instantly" ? "Instantly" : "Smartlead"
                      } API key`}
                      className="pr-10"
                    />
                    {apiKeyValid !== null && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {apiKeyValid ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={validateApiKey}
                    disabled={!apiKey.trim() || validatingKey}
                  >
                    {validatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedProvider === "instantly"
                    ? "Find your API key in Instantly Settings > Integrations > API"
                    : "Find your API key in Smartlead Settings > API"}
                </p>
                {apiKeyValid === false && (
                  <p className="text-xs text-red-500 mt-1">Invalid API key. Please check and try again.</p>
                )}
              </div>

              {/* Campaign count indicator */}
              {apiKeyValid && campaigns.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  Found {campaigns.length} campaigns ({availableCampaigns.length} available to link)
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!apiKeyValid || availableCampaigns.length === 0 || loadingCampaigns}
              >
                {loadingCampaigns ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
