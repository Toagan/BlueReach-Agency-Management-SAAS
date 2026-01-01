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
import { Mail, RefreshCw, Download, ArrowUpRight, ArrowDownLeft, Building, Phone, Globe, Linkedin, User, Calendar, BarChart3 } from "lucide-react";
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
            {lead.first_name || lead.last_name
              ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
              : lead.email}
            <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
            {lead.is_positive_reply && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Positive
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-sm">
            {lead.email}
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
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {emails.map((email, index) => (
                  <div
                    key={email.id}
                    className={`p-3 rounded-lg text-sm border ${
                      email.direction === "outbound"
                        ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                        : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            email.direction === "outbound"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300"
                          }
                        >
                          {email.direction === "outbound" ? (
                            <><ArrowUpRight className="h-3 w-3 mr-1" /> Sent</>
                          ) : (
                            <><ArrowDownLeft className="h-3 w-3 mr-1" /> Reply</>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Step {email.sequence_step || index + 1}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {email.sent_at ? new Date(email.sent_at).toLocaleString() : ""}
                      </span>
                    </div>
                    {email.subject && (
                      <p className="font-medium text-foreground mb-2 text-sm">
                        Subject: {email.subject}
                      </p>
                    )}
                    <div className="border-t border-border pt-2 mt-2">
                      {email.body_html ? (
                        <div
                          className="text-foreground text-sm [&_div]:mb-1 [&_br]:block [&_a]:text-blue-600 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: email.body_html }}
                        />
                      ) : (
                        <p className="text-foreground whitespace-pre-wrap text-sm">
                          {email.body_text || "(No content)"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                      <span>From: {email.from_email}</span>
                      <span>→</span>
                      <span>To: {email.to_email}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lead Info */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Lead Information
            </h4>
            <dl className="space-y-2 text-sm">
              {lead.company_name && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.company_name}</span>
                </div>
              )}
              {lead.company_domain && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`https://${lead.company_domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {lead.company_domain}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                    {lead.phone}
                  </a>
                </div>
              )}
              {lead.linkedin_url && (
                <div className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={lead.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {lead.personalization && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Personalization:</p>
                  <p className="text-sm">{lead.personalization}</p>
                </div>
              )}
            </dl>
          </div>

          {/* Email Stats */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Email Stats
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-muted rounded-md text-center">
                <p className="text-lg font-semibold">{lead.email_open_count || 0}</p>
                <p className="text-xs text-muted-foreground">Opens</p>
              </div>
              <div className="p-2 bg-muted rounded-md text-center">
                <p className="text-lg font-semibold">{lead.email_click_count || 0}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </div>
              <div className="p-2 bg-muted rounded-md text-center">
                <p className="text-lg font-semibold">{lead.email_reply_count || 0}</p>
                <p className="text-xs text-muted-foreground">Replies</p>
              </div>
            </div>
          </div>

          {/* Dates & IDs */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h4>
            <dl className="space-y-2 text-sm">
              {lead.last_contacted_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last Contacted</dt>
                  <dd>{new Date(lead.last_contacted_at).toLocaleString()}</dd>
                </div>
              )}
              {lead.instantly_created_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Added to Instantly</dt>
                  <dd>{new Date(lead.instantly_created_at).toLocaleString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created in DB</dt>
                <dd>{new Date(lead.created_at).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd>{new Date(lead.updated_at).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lead ID</dt>
                <dd className="font-mono text-xs">{lead.id.slice(0, 8)}...</dd>
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
