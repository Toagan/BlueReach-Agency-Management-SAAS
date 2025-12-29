"use client";

import { useState, useEffect } from "react";
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
import { Mail, RefreshCw, Download, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { Lead, LeadStatus, LeadEmail } from "@/types/database";

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
  contacted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  opened: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  clicked: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  replied: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  booked: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  won: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  not_interested: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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
  const [emails, setEmails] = useState<LeadEmail[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);

  // Reset notes when lead changes
  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
    }
  }, [lead?.id, lead?.notes]);

  // Fetch emails when panel opens
  useEffect(() => {
    if (open && lead) {
      fetchEmails();
    }
  }, [open, lead?.id]);

  const fetchEmails = async () => {
    if (!lead) return;
    setIsLoadingEmails(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const syncEmails = async () => {
    if (!lead) return;
    setIsSyncingEmails(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/emails`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchEmails();
      }
    } catch (error) {
      console.error("Failed to sync emails:", error);
    } finally {
      setIsSyncingEmails(false);
    }
  };

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
            <label className="text-sm font-medium text-foreground">Status</label>
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
            <label className="text-sm font-medium text-foreground">Notes</label>
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

          {/* Email Thread */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Thread ({emails.length})
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={syncEmails}
                disabled={isSyncingEmails}
              >
                <Download className={`h-3 w-3 mr-1 ${isSyncingEmails ? "animate-spin" : ""}`} />
                {isSyncingEmails ? "Syncing..." : "Sync"}
              </Button>
            </div>

            {isLoadingEmails ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No emails synced yet</p>
                <p className="text-xs mt-1">Click "Sync" to fetch from Instantly</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-3 rounded-lg text-sm ${
                      email.direction === "outbound"
                        ? "bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-500"
                        : "bg-green-50 dark:bg-green-950 border-l-2 border-green-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {email.direction === "outbound" ? (
                          <ArrowUpRight className="h-3 w-3 text-blue-500" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-green-500" />
                        )}
                        {email.direction === "outbound" ? "Sent" : "Received"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {email.sent_at ? new Date(email.sent_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    {email.subject && (
                      <p className="font-medium text-foreground mb-1">{email.subject}</p>
                    )}
                    <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {email.body_text || "(No content)"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-foreground mb-2">Details</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lead ID</dt>
                <dd className="font-mono text-xs">{lead.id.slice(0, 8)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd>{new Date(lead.updated_at).toLocaleString()}</dd>
              </div>
              {lead.instantly_lead_id && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Instantly ID</dt>
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
