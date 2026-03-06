"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Trash2,
} from "lucide-react";

interface CopyReview {
  id: string;
  campaign_id: string;
  step_number: number;
  variant: string;
  status: "pending" | "approved" | "rejected";
  comment: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  updated_at: string;
}

interface CopyComment {
  id: string;
  campaign_id: string;
  step_number: number;
  variant: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  comment: string;
  user_id: string;
  user_name: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface CopyReviewProps {
  campaignId: string;
  stepNumber: number;
  variant: string;
  bodyText: string;
  onBodyRender?: (html: string) => void;
}

// Hook to manage all review data for a campaign
export function useCopyReview(campaignId: string) {
  const [reviews, setReviews] = useState<CopyReview[]>([]);
  const [comments, setComments] = useState<CopyComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/copy-review`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setComments(data.comments);
      }
    } catch (err) {
      console.error("[CopyReview] Error fetching:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitReview = async (
    stepNumber: number,
    variant: string,
    status: "approved" | "rejected" | "pending",
    comment?: string
  ) => {
    const res = await fetch(`/api/campaigns/${campaignId}/copy-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", stepNumber, variant, status, comment }),
    });
    if (res.ok) {
      const data = await res.json();
      setReviews((prev) => {
        const idx = prev.findIndex(
          (r) => r.step_number === stepNumber && r.variant === variant
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.review;
          return updated;
        }
        return [...prev, data.review];
      });
    }
  };

  const addComment = async (
    stepNumber: number,
    variant: string,
    selectedText: string,
    startOffset: number,
    endOffset: number,
    comment: string
  ) => {
    const res = await fetch(`/api/campaigns/${campaignId}/copy-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "comment",
        stepNumber,
        variant,
        selectedText,
        startOffset,
        endOffset,
        comment,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
    }
  };

  const resolveComment = async (commentId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}/copy-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", commentId }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.comment : c))
      );
    }
  };

  const unresolveComment = async (commentId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}/copy-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unresolve", commentId }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.comment : c))
      );
    }
  };

  const deleteComment = async (commentId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}/copy-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-comment", commentId }),
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const getReview = (stepNumber: number, variant: string) =>
    reviews.find((r) => r.step_number === stepNumber && r.variant === variant);

  const getComments = (stepNumber: number, variant: string) =>
    comments.filter((c) => c.step_number === stepNumber && c.variant === variant);

  return {
    reviews,
    comments,
    loading,
    submitReview,
    addComment,
    resolveComment,
    unresolveComment,
    deleteComment,
    getReview,
    getComments,
    refresh: fetchData,
  };
}

// Review status badge
export function ReviewStatusBadge({ review }: { review?: CopyReview }) {
  if (!review || review.status === "pending") {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
        <Clock className="h-3 w-3" />
        Pending Review
      </Badge>
    );
  }

  if (review.status === "approved") {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Approved{review.reviewer_name ? ` by ${review.reviewer_name}` : ""}
      </Badge>
    );
  }

  return (
    <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800 gap-1">
      <XCircle className="h-3 w-3" />
      Changes Requested{review.reviewer_name ? ` by ${review.reviewer_name}` : ""}
    </Badge>
  );
}

// Approve/Reject buttons with optional reject comment
export function ReviewActions({
  review,
  onApprove,
  onReject,
  onReset,
}: {
  review?: CopyReview;
  onApprove: () => void;
  onReject: (comment: string) => void;
  onReset: () => void;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const handleReject = () => {
    onReject(rejectComment);
    setShowRejectInput(false);
    setRejectComment("");
  };

  if (review?.status === "approved") {
    return (
      <div className="flex items-center gap-2">
        <ReviewStatusBadge review={review} />
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>
    );
  }

  if (review?.status === "rejected") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ReviewStatusBadge review={review} />
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs text-muted-foreground">
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
        {review.comment && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-md p-2 border border-red-200 dark:border-red-800">
            {review.comment}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
          onClick={onApprove}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
          onClick={() => setShowRejectInput(!showRejectInput)}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Request Changes
        </Button>
      </div>
      {showRejectInput && (
        <div className="flex gap-2">
          <Textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="What needs to change?"
            className="text-sm min-h-[60px]"
          />
          <Button size="sm" onClick={handleReject} className="h-8 self-end">
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

// Inline comment popover that appears on text selection
export function InlineCommentInput({
  onSubmit,
  onCancel,
  position,
}: {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
  position: { top: number; left: number };
}) {
  const [comment, setComment] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-64"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        Add Comment
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Your feedback..."
        className="text-sm min-h-[60px] mb-2"
        autoFocus
      />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (comment.trim()) onSubmit(comment.trim());
          }}
          disabled={!comment.trim()}
          className="h-7 text-xs"
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

// Comment thread sidebar for a specific variant
export function CommentThread({
  comments,
  onResolve,
  onUnresolve,
  onDelete,
  showResolved,
}: {
  comments: CopyComment[];
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
  onDelete: (id: string) => void;
  showResolved?: boolean;
}) {
  const filtered = showResolved
    ? comments
    : comments.filter((c) => !c.resolved);

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        {filtered.length} comment{filtered.length !== 1 ? "s" : ""}
        {!showResolved && comments.some((c) => c.resolved) && (
          <span className="text-muted-foreground/60">
            ({comments.filter((c) => c.resolved).length} resolved)
          </span>
        )}
      </div>
      {filtered.map((c) => (
        <div
          key={c.id}
          className={`text-sm rounded-md p-2.5 border ${
            c.resolved
              ? "bg-muted/30 border-border/50 opacity-60"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-medium text-xs">
                  {c.user_name || "Unknown"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
                {c.resolved && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-300">
                    Resolved
                  </Badge>
                )}
              </div>
              <div className="bg-muted/50 rounded px-1.5 py-0.5 text-xs text-muted-foreground mb-1 font-mono truncate">
                &ldquo;{c.selected_text}&rdquo;
              </div>
              <p className="text-sm">{c.comment}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {c.resolved ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUnresolve(c.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  title="Reopen"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(c.id)}
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                  title="Resolve"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(c.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Text body with highlight support - wraps the copy text and enables selection + commenting
export function ReviewableBody({
  bodyHtml,
  bodyText,
  comments,
  stepNumber,
  variant,
  onAddComment,
}: {
  bodyHtml?: string;
  bodyText?: string;
  comments: CopyComment[];
  stepNumber: number;
  variant: string;
  onAddComment: (
    stepNumber: number,
    variant: string,
    selectedText: string,
    startOffset: number,
    endOffset: number,
    comment: string
  ) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 2) return;

    // Check selection is within our container
    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    // Get offsets relative to text content
    const fullText = containerRef.current.textContent || "";
    const preRange = document.createRange();
    preRange.selectNodeContents(containerRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + text.length;

    // Position popover near selection
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setSelection({ text, startOffset, endOffset });
    setPopoverPos({
      top: rect.bottom - containerRect.top + 8,
      left: Math.min(rect.left - containerRect.left, containerRect.width - 270),
    });
  }, []);

  const handleSubmitComment = useCallback(
    (comment: string) => {
      if (selection) {
        onAddComment(
          stepNumber,
          variant,
          selection.text,
          selection.startOffset,
          selection.endOffset,
          comment
        );
      }
      setSelection(null);
      setPopoverPos(null);
      window.getSelection()?.removeAllRanges();
    },
    [selection, stepNumber, variant, onAddComment]
  );

  const handleCancelComment = useCallback(() => {
    setSelection(null);
    setPopoverPos(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Build highlighted HTML by applying comment highlights to the text
  const unresolvedComments = comments.filter((c) => !c.resolved);

  const getHighlightedContent = () => {
    if (!bodyHtml && !bodyText) return "";
    const content = bodyHtml || bodyText || "";

    if (unresolvedComments.length === 0) return content;

    // For HTML content, we render the highlights via CSS marks
    // We'll use data attributes on the container and let the comments
    // show as sidebar indicators instead of inline modifications
    // (modifying innerHTML with highlights risks breaking HTML structure)
    return content;
  };

  return (
    <div className="relative" ref={containerRef} onMouseUp={handleMouseUp}>
      {/* Hint text */}
      {unresolvedComments.length === 0 && (
        <div className="text-[10px] text-muted-foreground/50 mb-1 select-none">
          Select text to add a comment
        </div>
      )}

      {/* The copy body */}
      {bodyHtml ? (
        <div
          className="text-sm prose prose-sm dark:prose-invert max-w-none [&_div]:mb-1 [&_br]:block [&_a]:text-blue-600 [&_a]:underline selection:bg-amber-200 dark:selection:bg-amber-800"
          dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
        />
      ) : (
        <div className="text-sm whitespace-pre-wrap selection:bg-amber-200 dark:selection:bg-amber-800">
          {bodyText}
        </div>
      )}

      {/* Comment count indicator */}
      {unresolvedComments.length > 0 && (
        <div className="absolute top-0 right-0 flex items-center gap-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <MessageSquare className="h-2.5 w-2.5" />
          {unresolvedComments.length}
        </div>
      )}

      {/* Inline comment popover */}
      {selection && popoverPos && (
        <InlineCommentInput
          onSubmit={handleSubmitComment}
          onCancel={handleCancelComment}
          position={popoverPos}
        />
      )}
    </div>
  );
}
