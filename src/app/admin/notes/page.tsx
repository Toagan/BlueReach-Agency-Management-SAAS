"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  FileText,
  Clock,
  Check,
  Loader2,
} from "lucide-react";

export default function NotesPage() {
  const [content, setContent] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load notes from API on mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const res = await fetch("/api/admin/notes");
        if (res.ok) {
          const data = await res.json();
          setContent(data.content || "");
          if (data.updated_at) {
            setLastSaved(new Date(data.updated_at));
          }
        }
      } catch (error) {
        console.error("Failed to load notes:", error);
      }
    };
    loadNotes();
  }, []);

  // Save notes to API
  const saveNotes = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setLastSaved(new Date());
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setSaving(false);
    }
  }, [content]);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      saveNotes();
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, hasChanges, saveNotes]);

  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(true);
  };

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNotes();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveNotes]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Notes</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Save status indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : hasChanges ? (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Unsaved changes</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span>
                      Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </>
                ) : null}
              </div>
              <Button
                size="sm"
                onClick={saveNotes}
                disabled={saving || !hasChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Card className="min-h-[calc(100vh-200px)] p-0 overflow-hidden">
          <textarea
            value={content}
            onChange={handleChange}
            placeholder="Start writing your notes here...

Use this space to document:
- Workflow ideas and processes
- Campaign strategies
- Client notes and requirements
- Integration plans
- Anything else you want to remember"
            className="w-full h-full min-h-[calc(100vh-200px)] p-8 bg-transparent resize-none focus:outline-none text-base leading-relaxed font-sans"
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            }}
          />
        </Card>

        {/* Tips */}
        <div className="mt-4 text-sm text-muted-foreground text-center">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Cmd</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">S</kbd>
            <span className="ml-1">to save</span>
          </span>
          <span className="mx-3">|</span>
          <span>Auto-saves after 2 seconds of inactivity</span>
        </div>
      </div>
    </div>
  );
}
