"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Phone,
  Globe,
  Linkedin,
  User,
  Calendar,
  MousePointer,
  Eye,
  MessageSquare,
  ThumbsUp,
  Clock,
  Hash,
  ExternalLink,
  Copy,
  Check,
  X,
} from "lucide-react";
import type { Lead, LeadStatus, LeadEmail } from "@/types/database";

interface LeadDetailPanelProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (leadId: string, status: LeadStatus) => Promise<void>;
  onNotesChange: (leadId: string, notes: string) => Promise<void>;
}

const statusOptions: { value: LeadStatus; label: string; color: string }[] = [
  { value: "contacted", label: "Contacted", color: "bg-slate-500" },
  { value: "opened", label: "Opened", color: "bg-amber-500" },
  { value: "clicked", label: "Clicked", color: "bg-orange-500" },
  { value: "replied", label: "Replied", color: "bg-blue-500" },
  { value: "booked", label: "Meeting Booked", color: "bg-emerald-500" },
  { value: "won", label: "Closed Won", color: "bg-green-500" },
  { value: "lost", label: "Closed Lost", color: "bg-red-500" },
  { value: "not_interested", label: "Not Interested", color: "bg-gray-500" },
];

const statusColors: Record<LeadStatus, string> = {
  contacted: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  opened: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  clicked: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  replied: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  booked: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  won: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  not_interested: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
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
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
    }
  }, [lead?.id, lead?.notes]);

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

  const copyEmail = () => {
    if (lead?.email) {
      navigator.clipboard.writeText(lead.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
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

  const displayName = lead.first_name || lead.last_name
    ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
    : null;

  const getInitials = () => {
    if (lead.first_name && lead.last_name) {
      return `${lead.first_name[0]}${lead.last_name[0]}`.toUpperCase();
    }
    if (lead.first_name) return lead.first_name[0].toUpperCase();
    if (lead.email) return lead.email[0].toUpperCase();
    return "?";
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[480px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
          <SheetTitle className="sr-only">
            Lead Details: {displayName || lead.email}
          </SheetTitle>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold text-primary">{getInitials()}</span>
            </div>
            <div className="flex-1 min-w-0">
              {displayName && (
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {displayName}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate flex-1">{lead.email}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={copyEmail}
                >
                  {copiedEmail ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={statusColors[lead.status]}>
                  {statusOptions.find(s => s.value === lead.status)?.label || lead.status}
                </Badge>
                {lead.is_positive_reply && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    Positive
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-background p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-xs">Opens</span>
            </div>
            <p className="text-lg font-semibold">{lead.email_open_count || 0}</p>
          </div>
          <div className="bg-background p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <MousePointer className="h-3.5 w-3.5" />
              <span className="text-xs">Clicks</span>
            </div>
            <p className="text-lg font-semibold">{lead.email_click_count || 0}</p>
          </div>
          <div className="bg-background p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs">Replies</span>
            </div>
            <p className="text-lg font-semibold">{lead.email_reply_count || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger
              value="details"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="emails"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Emails ({emails.length})
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Notes
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Details Tab */}
            <TabsContent value="details" className="m-0 p-4 space-y-4">
              {/* Status Selector */}
              <Card>
                <CardContent className="p-4">
                  <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
                  <Select
                    value={lead.status}
                    onValueChange={(value) => handleStatusChange(value as LeadStatus)}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${option.color}`} />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Information
                  </h4>
                  <div className="space-y-3">
                    {lead.company_name && (
                      <div className="flex items-center gap-3 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{lead.company_name}</span>
                      </div>
                    )}
                    {lead.company_domain && (
                      <div className="flex items-center gap-3 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={`https://${lead.company_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {lead.company_domain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                          {lead.phone}
                        </a>
                      </div>
                    )}
                    {lead.linkedin_url && (
                      <div className="flex items-center gap-3 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          LinkedIn Profile
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {!lead.company_name && !lead.company_domain && !lead.phone && !lead.linkedin_url && (
                      <p className="text-sm text-muted-foreground">No additional contact info available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Personalization */}
              {lead.personalization && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-foreground mb-2">Personalization</h4>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {lead.personalization}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    {lead.last_contacted_at && (
                      <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          Last Contacted
                        </span>
                        <span>{new Date(lead.last_contacted_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        Created
                      </span>
                      <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Updated
                      </span>
                      <span>{new Date(lead.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* IDs */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Reference IDs
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Lead ID</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{lead.id.slice(0, 12)}...</code>
                    </div>
                    {lead.instantly_lead_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Instantly ID</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{lead.instantly_lead_id.slice(0, 12)}...</code>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" className="m-0 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Thread
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncEmails}
                  disabled={isSyncingEmails}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncingEmails ? "animate-spin" : ""}`} />
                  {isSyncingEmails ? "Syncing..." : "Sync"}
                </Button>
              </div>

              {isLoadingEmails ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No emails yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Click Sync to fetch emails from Instantly</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((email, index) => (
                    <Card
                      key={email.id}
                      className={`overflow-hidden ${
                        email.direction === "outbound"
                          ? "border-l-4 border-l-blue-500"
                          : "border-l-4 border-l-green-500"
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant="secondary"
                            className={
                              email.direction === "outbound"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            }
                          >
                            {email.direction === "outbound" ? (
                              <><ArrowUpRight className="h-3 w-3 mr-1" /> Sent</>
                            ) : (
                              <><ArrowDownLeft className="h-3 w-3 mr-1" /> Reply</>
                            )}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {email.sent_at ? new Date(email.sent_at).toLocaleString() : ""}
                          </span>
                        </div>
                        {email.subject && (
                          <p className="font-medium text-sm mb-2 truncate" title={email.subject}>
                            {email.subject}
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {email.body_html ? (
                            <div
                              className="prose prose-sm max-w-none dark:prose-invert [&_*]:text-sm [&_a]:text-primary"
                              dangerouslySetInnerHTML={{
                                __html: email.body_html.length > 300
                                  ? email.body_html.slice(0, 300) + "..."
                                  : email.body_html
                              }}
                            />
                          ) : (
                            <p className="line-clamp-3">
                              {email.body_text || "(No content)"}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 p-4">
              <div className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  className="min-h-[200px] resize-none"
                />
                <Button
                  onClick={handleNotesSave}
                  disabled={isSaving || notes === lead.notes}
                  className="w-full"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Notes"
                  )}
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
