"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CreditCard,
  Plus,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { Subscription, BillingCycle } from "@/types/database";

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

const CATEGORIES = [
  "Email Outreach",
  "Lead Generation",
  "Data Enrichment",
  "CRM",
  "Analytics",
  "Infrastructure",
  "Other",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRenewingSoon(date: string | null): boolean {
  if (!date) return false;
  const renewalDate = new Date(date);
  const today = new Date();
  const diffDays = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7 && diffDays >= 0;
}

function getCycleMultiplier(cycle: BillingCycle): number {
  switch (cycle) {
    case "yearly": return 1 / 12;
    case "quarterly": return 1 / 3;
    case "weekly": return 4.33;
    case "monthly":
    case "custom":
    default: return 1;
  }
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    username: "",
    password: "",
    cost: "",
    billing_cycle: "monthly" as BillingCycle,
    renewal_date: "",
    credits_balance: "",
    credits_limit: "",
    category: "",
    notes: "",
  });

  // UI states
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/subscriptions");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch subscriptions");
      }

      setSubscriptions(data.subscriptions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch subscriptions");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      url: "",
      username: "",
      password: "",
      cost: "",
      billing_cycle: "monthly",
      renewal_date: "",
      credits_balance: "",
      credits_limit: "",
      category: "",
      notes: "",
    });
    setEditingSubscription(null);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(subscription: Subscription) {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      url: subscription.url || "",
      username: subscription.username || "",
      password: subscription.password || "",
      cost: subscription.cost.toString(),
      billing_cycle: subscription.billing_cycle,
      renewal_date: subscription.renewal_date || "",
      credits_balance: subscription.credits_balance.toString(),
      credits_limit: subscription.credits_limit.toString(),
      category: subscription.category || "",
      notes: subscription.notes || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      const url = editingSubscription
        ? `/api/admin/subscriptions/${editingSubscription.id}`
        : "/api/admin/subscriptions";

      const res = await fetch(url, {
        method: editingSubscription ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save subscription");
      }

      await fetchSubscriptions();
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save subscription");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete subscription");
      }

      await fetchSubscriptions();
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subscription");
    }
  }

  function togglePasswordVisibility(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  // Calculate totals
  const totalMonthly = subscriptions.reduce((sum, sub) => {
    return sum + sub.cost * getCycleMultiplier(sub.billing_cycle);
  }, 0);

  const totalCredits = subscriptions.reduce((sum, sub) => sum + sub.credits_balance, 0);
  const totalCreditsLimit = subscriptions.reduce((sum, sub) => sum + sub.credits_limit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Center
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Subscriptions
          </h1>
          <p className="text-muted-foreground">
            Track your agency SaaS tools, costs, and credits
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Subscription
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No subscriptions yet</h3>
              <p className="text-muted-foreground mt-1">
                Add your first subscription to start tracking expenses
              </p>
              <Button className="mt-4" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subscription
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Tool</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold text-right">Cost</TableHead>
                    <TableHead className="font-semibold">Cycle</TableHead>
                    <TableHead className="font-semibold">Renews</TableHead>
                    <TableHead className="font-semibold">Credits</TableHead>
                    <TableHead className="font-semibold">Login</TableHead>
                    <TableHead className="font-semibold w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => {
                    const creditsPercent = sub.credits_limit > 0
                      ? (sub.credits_balance / sub.credits_limit) * 100
                      : 0;
                    const isLowCredits = creditsPercent < 20 && sub.credits_limit > 0;
                    const renewingSoon = isRenewingSoon(sub.renewal_date);

                    return (
                      <TableRow key={sub.id} className="group">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {sub.name}
                            {sub.url && (
                              <a
                                href={sub.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          {sub.notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {sub.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {sub.category ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {sub.category}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(sub.cost)}
                        </TableCell>
                        <TableCell className="capitalize">{sub.billing_cycle}</TableCell>
                        <TableCell>
                          <span className={renewingSoon ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                            {formatDate(sub.renewal_date)}
                            {renewingSoon && " (soon)"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {sub.credits_limit > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className={isLowCredits ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                                  {sub.credits_balance.toLocaleString()}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">
                                  {sub.credits_limit.toLocaleString()}
                                </span>
                              </div>
                              <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isLowCredits
                                      ? "bg-red-500"
                                      : creditsPercent < 50
                                      ? "bg-amber-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{ width: `${Math.min(creditsPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sub.username ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                                {sub.username}
                              </span>
                              {sub.password && (
                                <>
                                  <button
                                    onClick={() => togglePasswordVisibility(sub.id)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                  >
                                    {visiblePasswords.has(sub.id) ? (
                                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(sub.password!, `pwd-${sub.id}`)}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                  >
                                    {copiedId === `pwd-${sub.id}` ? (
                                      <Check className="h-3.5 w-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {visiblePasswords.has(sub.id) && sub.password && (
                            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mt-1">
                              {sub.password}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(sub)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {deleteConfirmId === sub.id ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8"
                                onClick={() => handleDelete(sub.id)}
                              >
                                Confirm
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => setDeleteConfirmId(sub.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Summary Row */}
                  <TableRow className="bg-muted/30 font-medium border-t-2">
                    <TableCell>Total ({subscriptions.length} tools)</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalMonthly)}/mo
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell>
                      {totalCreditsLimit > 0 && (
                        <span>
                          {totalCredits.toLocaleString()} / {totalCreditsLimit.toLocaleString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingSubscription ? "Edit Subscription" : "Add Subscription"}
              </DialogTitle>
              <DialogDescription>
                {editingSubscription
                  ? "Update the details for this subscription"
                  : "Add a new SaaS tool to track"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Name */}
              <div>
                <Label htmlFor="name">Tool Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Instantly, Clay, Smartlead"
                  className="mt-1"
                />
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* URL */}
              <div>
                <Label htmlFor="url">Login URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://app.instantly.ai"
                  className="mt-1"
                />
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username/Email</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Cost & Billing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cost">Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="99.00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_cycle">Billing Cycle</Label>
                  <Select
                    value={formData.billing_cycle}
                    onValueChange={(value) => setFormData({ ...formData, billing_cycle: value as BillingCycle })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_CYCLES.map((cycle) => (
                        <SelectItem key={cycle.value} value={cycle.value}>
                          {cycle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Renewal Date */}
              <div>
                <Label htmlFor="renewal_date">Next Renewal Date</Label>
                <Input
                  id="renewal_date"
                  type="date"
                  value={formData.renewal_date}
                  onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                  className="mt-1"
                />
              </div>

              {/* Credits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="credits_balance">Current Credits</Label>
                  <Input
                    id="credits_balance"
                    type="number"
                    value={formData.credits_balance}
                    onChange={(e) => setFormData({ ...formData, credits_balance: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="credits_limit">Credit Limit</Label>
                  <Input
                    id="credits_limit"
                    type="number"
                    value={formData.credits_limit}
                    onChange={(e) => setFormData({ ...formData, credits_limit: e.target.value })}
                    placeholder="10000"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !formData.name.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingSubscription ? (
                  "Update"
                ) : (
                  "Add Subscription"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
