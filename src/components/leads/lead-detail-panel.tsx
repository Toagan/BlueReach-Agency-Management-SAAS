"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadStatus } from "@/types/database";

interface LeadDetailPanelProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (leadId: string, status: LeadStatus) => Promise<void>;
  onNotesChange: (leadId: string, notes: string) => Promise<void>;
}

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "contacted", label: "Contacted" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "replied", label: "Replied" },
  { value: "booked", label: "Meeting Booked" },
  { value: "won", label: "Closed Won" },
  { value: "lost", label: "Closed Lost" },
  { value: "not_interested", label: "Not Interested" },
];

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

export function LeadDetailPanel({
  lead,
  open,
  onClose,
  onStatusChange,
  onNotesChange,
}: LeadDetailPanelProps) {
  const [notes, setNotes] = useState(lead?.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  if (!lead) return null;

  const handleStatusChange = async (status: LeadStatus) => {
    setIsSaving(true);
    await onStatusChange(lead.id, status);
    setIsSaving(false);
  };

  const handleNotesSave = async () => {
    setIsSaving(true);
    await onNotesChange(lead.id, notes);
    setIsSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {lead.email}
            <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
          </SheetTitle>
          <SheetDescription>
            {lead.first_name && <span>Name: {lead.first_name}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select
              value={lead.status}
              onValueChange={(value) => handleStatusChange(value as LeadStatus)}
              disabled={isSaving}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this lead..."
              className="mt-1 min-h-[150px]"
            />
            <Button
              onClick={handleNotesSave}
              disabled={isSaving || notes === lead.notes}
              className="mt-2"
              size="sm"
            >
              {isSaving ? "Saving..." : "Save Notes"}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Lead ID</dt>
                <dd className="font-mono text-xs">{lead.id.slice(0, 8)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Last Updated</dt>
                <dd>{new Date(lead.updated_at).toLocaleString()}</dd>
              </div>
              {lead.instantly_lead_id && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Instantly ID</dt>
                  <dd className="font-mono text-xs">
                    {lead.instantly_lead_id.slice(0, 8)}...
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
