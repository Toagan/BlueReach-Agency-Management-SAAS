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
import { RefreshCw, Copy, Check, ExternalLink } from "lucide-react";

interface InstantlyCampaign {
  id: string;
  name: string;
  status: number | string;
}

interface AddCampaignDialogProps {
  clientId: string;
}

export function AddCampaignDialog({ clientId }: AddCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [instantlyCampaigns, setInstantlyCampaigns] = useState<InstantlyCampaign[]>([]);
  const [linkedCampaignIds, setLinkedCampaignIds] = useState<Set<string>>(new Set());
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showSuccess, setShowSuccess] = useState(false);
  const [linkedCampaignName, setLinkedCampaignName] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Generate webhook URL
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/instantly`
    : "";

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      // Fetch Instantly campaigns
      const res = await fetch("/api/instantly/campaigns");
      const data = await res.json();
      setInstantlyCampaigns(data.campaigns || []);

      // Fetch already linked campaigns
      const { data: linked } = await supabase
        .from("campaigns")
        .select("instantly_campaign_id")
        .not("instantly_campaign_id", "is", null);

      const linkedIds = new Set(
        (linked || []).map((c) => c.instantly_campaign_id).filter(Boolean)
      );
      setLinkedCampaignIds(linkedIds as Set<string>);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCampaigns();
    }
  }, [open]);

  const selectedCampaign = instantlyCampaigns.find((c) => c.id === selectedCampaignId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCampaignId) return;

    const campaignName = customName.trim() || selectedCampaign?.name || "Unnamed Campaign";

    const { error } = await supabase.from("campaigns").insert({
      client_id: clientId,
      name: campaignName,
      instantly_campaign_id: selectedCampaignId,
      is_active: selectedCampaign?.status === 1 || selectedCampaign?.status === "active",
    });

    if (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to link campaign: " + error.message);
      return;
    }

    // Show success with webhook URL
    setLinkedCampaignName(campaignName);
    setShowSuccess(true);

    startTransition(() => {
      router.refresh();
    });
  };

  const handleClose = () => {
    setOpen(false);
    setShowSuccess(false);
    setSelectedCampaignId("");
    setCustomName("");
    setCopied(false);
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const availableCampaigns = instantlyCampaigns.filter(
    (c) => !linkedCampaignIds.has(c.id)
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>Link Campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {showSuccess ? (
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
                  Set up Webhook in Instantly
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  To receive real-time updates (opens, clicks, replies), add this webhook URL in your Instantly campaign settings:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="bg-white text-sm font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyWebhookUrl}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">
                  Webhook Events to Enable
                </h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• <strong>reply_received</strong> - When lead replies</li>
                  <li>• <strong>lead_interested</strong> - Positive reply detected</li>
                  <li>• <strong>email_opened</strong> - When email is opened</li>
                  <li>• <strong>link_clicked</strong> - When link is clicked</li>
                </ul>
              </div>

              <a
                href="https://app.instantly.ai/app/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Open Instantly Webhook Settings
              </a>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Form state
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Link Instantly Campaign</DialogTitle>
              <DialogDescription>
                Select a campaign from Instantly to link to this client.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : availableCampaigns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No unlinked campaigns available.</p>
                  <p className="text-sm mt-1">All your Instantly campaigns are already linked to clients.</p>
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
                                  campaign.status === 1 || campaign.status === "active"
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              />
                              {campaign.name}
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
                        Leave empty to use the Instantly campaign name
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !selectedCampaignId || loading}
              >
                {isPending ? "Linking..." : "Link Campaign"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
