"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "name" | "invite" | "complete";

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
  const [step, setStep] = useState<Step>("name");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const resetForm = () => {
    setStep("name");
    setCustomerName("");
    setClientFirstName("");
    setClientEmail("");
    setError(null);
    setCreatedCustomerId(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCreateCustomer = async () => {
    if (!customerName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create customer");
      }

      const data = await res.json();
      const customerId = data.client?.id || data.customer?.id || data.id;
      setCreatedCustomerId(customerId);

      // Send invitation if email provided
      if (clientEmail.trim()) {
        try {
          await fetch("/api/admin/invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: customerId,
              email: clientEmail.trim(),
              first_name: clientFirstName.trim() || null,
            }),
          });
        } catch (inviteErr) {
          console.error("Failed to send invitation:", inviteErr);
          // Don't fail the whole flow if invitation fails
        }
      }

      setStep("complete");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "name":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                placeholder="e.g., Acme Corporation"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                The company or brand name for this customer.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("invite")}
                disabled={!customerName.trim()}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "invite":
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Invite Client to Dashboard
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Send an email invitation to give your client access to their dashboard.
                They will sign in using Google authentication.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientFirstName">Client First Name</Label>
              <Input
                id="clientFirstName"
                placeholder="e.g., John"
                value={clientFirstName}
                onChange={(e) => setClientFirstName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email Address</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g., john@acme.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                An invitation will be sent to this email with a link to access the dashboard.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("name")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleCreateCustomer} disabled={isCreating}>
                  Skip & Create
                </Button>
                <Button onClick={handleCreateCustomer} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create & Send Invite
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold">Customer Created!</h3>
              <p className="text-muted-foreground">
                {customerName} has been set up successfully.
              </p>
              {clientEmail && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Invitation sent to {clientEmail}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = `/admin/clients/${createdCustomerId}`;
                }}
              >
                Go to Customer
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
    }
  };

  const stepTitles: Record<Step, string> = {
    name: "Customer Details",
    invite: "Client Access",
    complete: "Setup Complete",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          {step !== "complete" && (
            <div className="flex items-center gap-2 pt-2">
              {(["name", "invite"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${
                    (["name", "invite"] as Step[]).indexOf(step) >= i
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>
        <div className="pt-4">{renderStep()}</div>
      </DialogContent>
    </Dialog>
  );
}
