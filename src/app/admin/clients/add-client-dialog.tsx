"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Copy, Check, Mail } from "lucide-react";

interface Invite {
  name: string;
  email: string;
}

interface InviteResult {
  email: string;
  success: boolean;
  loginUrl?: string;
  error?: string;
  emailSent?: boolean;
}

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "results">("form");
  const [name, setName] = useState("");
  const [invites, setInvites] = useState<Invite[]>([{ name: "", email: "" }]);
  const [, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const addInvite = () => {
    setInvites([...invites, { name: "", email: "" }]);
  };

  const removeInvite = (index: number) => {
    if (invites.length > 1) {
      setInvites(invites.filter((_, i) => i !== index));
    }
  };

  const updateInvite = (index: number, field: "name" | "email", value: string) => {
    const newInvites = [...invites];
    newInvites[index][field] = value;
    setInvites(newInvites);
  };

  const copyToClipboard = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const resetForm = () => {
    setName("");
    setInvites([{ name: "", email: "" }]);
    setInviteResults([]);
    setStep("form");
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsCreating(true);

    try {
      // Create the client
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({ name: name.trim() })
        .select("id")
        .single();

      if (error || !newClient) {
        console.error("Error creating client:", error);
        setIsCreating(false);
        return;
      }

      // Send invitations for valid entries
      const validInvites = invites.filter((inv) => inv.email.trim());
      const results: InviteResult[] = [];

      for (const invite of validInvites) {
        try {
          const res = await fetch(`/api/clients/${newClient.id}/invitations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: invite.email.trim(),
              name: invite.name.trim(),
            }),
          });

          const data = await res.json();

          if (res.ok) {
            results.push({
              email: invite.email,
              success: true,
              loginUrl: data.loginUrl,
              emailSent: data.emailSent,
            });
          } else {
            results.push({
              email: invite.email,
              success: false,
              error: data.error || "Failed to send invitation",
            });
          }
        } catch (err) {
          results.push({
            email: invite.email,
            success: false,
            error: "Network error",
          });
        }
      }

      setInviteResults(results);

      if (results.length > 0) {
        setStep("results");
      } else {
        handleClose();
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button>Add Client</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {step === "form" ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Create a new client and invite team members to access their dashboard.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Client Name */}
              <div>
                <Label htmlFor="name">Client Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corporation"
                  className="mt-1"
                />
              </div>

              {/* Invitations */}
              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Invite Team Members (optional)
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Add people who should have access to this client&apos;s dashboard.
                </p>

                <div className="space-y-3">
                  {invites.map((invite, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={invite.name}
                        onChange={(e) => updateInvite(index, "name", e.target.value)}
                        placeholder="Name"
                        className="flex-1"
                      />
                      <Input
                        type="email"
                        value={invite.email}
                        onChange={(e) => updateInvite(index, "email", e.target.value)}
                        placeholder="email@example.com"
                        className="flex-1"
                      />
                      {invites.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInvite(index)}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInvite}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !name.trim()}>
                {isCreating ? "Creating..." : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Client Created Successfully</DialogTitle>
              <DialogDescription>
                Share these invitation links with your team members so they can access the dashboard.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              {inviteResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.success
                      ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{result.email}</span>
                    {result.success ? (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {result.emailSent ? "Email sent" : "Invited (share link)"}
                      </span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400">{result.error}</span>
                    )}
                  </div>
                  {result.success && result.loginUrl && !result.emailSent && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded border truncate">
                        {result.loginUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(result.loginUrl!, index)}
                        className="shrink-0"
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  {result.success && result.emailSent && (
                    <p className="text-xs text-muted-foreground">
                      The invitation email has been sent. They can click the link in the email to access the dashboard.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
