"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import DOMPurify from "dompurify";
import { Loader2, RefreshCw, Mail, Send, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Email {
  id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  sent_at: string | null;
  sequence_step: number | null;
  is_auto_reply: boolean;
}

interface EmailThreadProps {
  leadId: string;
  leadEmail?: string;
  onRefresh?: () => Promise<void>;
  className?: string;
}

export function EmailThread({ leadId, leadEmail, onRefresh, className }: EmailThreadProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchEmails = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("lead_emails")
        .select("id, direction, from_email, to_email, subject, body_text, body_html, sent_at, sequence_step, is_auto_reply")
        .eq("lead_id", leadId)
        .order("sent_at", { ascending: true });

      if (fetchError) throw fetchError;
      setEmails(data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching emails:", err);
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [leadId, supabase]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // If parent provides a refresh function (to sync from Instantly), call it first
      if (onRefresh) {
        await onRefresh();
      }
      // Then refresh the local data
      await fetchEmails();
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const sanitizeHtml = (html: string) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "b", "i", "u", "a", "ul", "ol", "li", "blockquote", "div", "span"],
      ALLOWED_ATTR: ["href", "target", "rel", "style"],
      ALLOW_DATA_ATTR: false,
    });
  };

  const renderEmailContent = (email: Email) => {
    if (email.body_html) {
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }}
        />
      );
    }
    if (email.body_text) {
      return <pre className="whitespace-pre-wrap font-sans text-sm">{email.body_text}</pre>;
    }
    return <p className="text-muted-foreground italic">No content available</p>;
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading emails...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            Email Thread {emails.length > 0 && `(${emails.length})`}
          </span>
          {leadEmail && (
            <span className="text-sm text-muted-foreground">
              with {leadEmail}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Empty state */}
      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No emails found for this lead.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Emails will appear here after syncing or when webhooks are received.
          </p>
        </div>
      ) : (
        /* Email thread - chat bubble layout */
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {emails.map((email) => {
            const isOutbound = email.direction === "outbound";

            return (
              <div
                key={email.id}
                className={cn(
                  "flex flex-col",
                  isOutbound ? "items-end" : "items-start"
                )}
              >
                {/* Message bubble */}
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg p-4",
                    isOutbound
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {/* Header with direction icon and subject */}
                  <div className="flex items-start gap-2 mb-2">
                    {isOutbound ? (
                      <Send className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Inbox className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {email.subject || "(No subject)"}
                      </p>
                      <p className={cn(
                        "text-xs",
                        isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {isOutbound ? `To: ${email.to_email}` : `From: ${email.from_email}`}
                        {email.sequence_step && ` (Step ${email.sequence_step})`}
                        {email.is_auto_reply && " (Auto-reply)"}
                      </p>
                    </div>
                  </div>

                  {/* Email body */}
                  <div className={cn(
                    "text-sm",
                    isOutbound ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {renderEmailContent(email)}
                  </div>
                </div>

                {/* Timestamp */}
                <span className={cn(
                  "text-xs text-muted-foreground mt-1",
                  isOutbound ? "mr-2" : "ml-2"
                )}>
                  {formatDate(email.sent_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
