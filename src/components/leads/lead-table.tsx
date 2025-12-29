"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadDetailPanel } from "./lead-detail-panel";
import type { Lead, LeadStatus } from "@/types/database";

interface LeadTableProps {
  leads: Lead[];
  onStatusChange: (leadId: string, status: LeadStatus) => Promise<void>;
  onNotesChange: (leadId: string, notes: string) => Promise<void>;
}

const statusColors: Record<LeadStatus, string> = {
  contacted: "bg-gray-100 text-gray-700",
  opened: "bg-yellow-100 text-yellow-700",
  clicked: "bg-orange-100 text-orange-700",
  replied: "bg-blue-100 text-blue-700",
  booked: "bg-green-100 text-green-700",
  won: "bg-purple-100 text-purple-700",
  lost: "bg-red-100 text-red-700",
  not_interested: "bg-slate-100 text-slate-700",
};

export function LeadTable({ leads, onStatusChange, onNotesChange }: LeadTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsPanelOpen(true);
  };

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    await onStatusChange(leadId, status);
    if (selectedLead?.id === leadId) {
      setSelectedLead({ ...selectedLead, status });
    }
  };

  const handleNotesChange = async (leadId: string, notes: string) => {
    await onNotesChange(leadId, notes);
    if (selectedLead?.id === leadId) {
      setSelectedLead({ ...selectedLead, notes });
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No leads yet
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(lead)}
                >
                  <TableCell className="font-medium">{lead.email}</TableCell>
                  <TableCell>{lead.first_name || "-"}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[lead.status]}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(lead.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(lead);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LeadDetailPanel
        lead={selectedLead}
        open={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
      />
    </>
  );
}
