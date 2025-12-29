"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadTable } from "@/components/leads/lead-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus, Campaign } from "@/types/database";

interface ClientLeadsViewProps {
  leads: (Lead & { campaigns: { client_id: string; name: string } })[];
  campaigns: Campaign[];
  clientId: string;
}

export function ClientLeadsView({
  leads: initialLeads,
  campaigns,
  clientId,
}: ClientLeadsViewProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const filteredLeads =
    selectedCampaign === "all"
      ? initialLeads
      : initialLeads.filter((lead) => lead.campaign_id === selectedCampaign);

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    startTransition(() => {
      router.refresh();
    });
  };

  const handleNotesChange = async (leadId: string, notes: string) => {
    await supabase
      .from("leads")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leads</CardTitle>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <LeadTable
          leads={filteredLeads}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
        />
      </CardContent>
    </Card>
  );
}
