"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Users, Mail, BarChart3, CheckCircle2, Shield } from "lucide-react";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  onConfirm: () => Promise<void>;
}

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customerName,
  onConfirm,
}: DeleteCustomerDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmValid = confirmText.toLowerCase() === customerName.toLowerCase();

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setConfirmText("");
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-center text-xl">
            Delete Customer
          </DialogTitle>
          <DialogDescription className="text-center space-y-2">
            <span className="block">
              You are about to permanently delete{" "}
              <span className="font-semibold text-foreground">{customerName}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* What will be preserved */}
          <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Your data is safe
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>All leads preserved with full history</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Positive replies and email threads kept</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Analytics and performance data retained</span>
              </div>
            </div>
          </div>

          {/* What will be deleted */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Will be removed:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>Campaign configurations</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Client user access</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Pending invitations</span>
              </div>
            </div>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{customerName}</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Enter customer name"
              className="font-mono"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="flex-1"
          >
            {isDeleting ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Forever
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
