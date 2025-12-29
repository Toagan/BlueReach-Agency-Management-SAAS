"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { RefreshCw, Play, Pause, ArrowLeft } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  leads_count?: number;
  analytics?: {
    total_leads: number;
    emails_sent: number;
    emails_opened: number;
    emails_replied: number;
    open_rate: number;
    reply_rate: number;
  };
}

export default function InstantlyCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/instantly/campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCampaignAction = async (campaignId: string, action: "activate" | "pause") => {
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/instantly/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (data.success) {
        fetchCampaigns();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
      <div className="flex justify-between items-center">
        <div>
          <Link
            href="/admin/instantly"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Instantly
          </Link>
          <h1 className="text-2xl font-bold mt-2">Instantly Campaigns</h1>
          <p className="text-gray-500">{campaigns.length} campaigns found</p>
        </div>
        <Button onClick={fetchCampaigns} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No campaigns found in Instantly
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Reply Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-right">
                      {campaign.analytics?.total_leads || campaign.leads_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.analytics?.emails_sent || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.analytics?.open_rate
                        ? `${(campaign.analytics.open_rate * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.analytics?.reply_rate
                        ? `${(campaign.analytics.reply_rate * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCampaignAction(campaign.id, "pause")}
                          disabled={actionLoading === campaign.id}
                        >
                          {actionLoading === campaign.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                      ) : campaign.status === "paused" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCampaignAction(campaign.id, "activate")}
                          disabled={actionLoading === campaign.id}
                        >
                          {actionLoading === campaign.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
