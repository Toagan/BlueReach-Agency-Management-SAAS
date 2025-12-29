"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  RefreshCw,
  Search,
  Plus,
  MoreHorizontal,
  ChevronDown,
  Activity,
  Eye,
  Trash2,
  Archive,
  MessageSquareReply,
  Target,
  Send,
} from "lucide-react";

interface OverviewStats {
  leadsContacted: number;
  emailsSent: number;
  replies: number;
  opportunities: number;
  replyRate: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  campaigns_count: number;
  total_leads: number;
  total_emails_sent: number;
  reply_rate: number;
}

type TabType = "customers" | "leads";
type CustomerFilter = "active" | "archived";
type TimeRange = "this_week" | "this_month" | "this_quarter";

export default function AdminCommandCenter() {
  const hasFetched = useRef(false);
  const [stats, setStats] = useState<OverviewStats>({
    leadsContacted: 0,
    emailsSent: 0,
    replies: 0,
    opportunities: 0,
    replyRate: 0,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("customers");
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("this_week");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // New customer dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (hasFetched.current && !force) return;
    hasFetched.current = true;
    setLoading(true);
    setError(null);

    try {
      // Fetch customers and analytics in parallel
      const [customersRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/customers"),
        fetch(`/api/admin/analytics?period=${timeRange}`),
      ]);

      const customersData = await customersRes.json();
      const analyticsData = await analyticsRes.json();

      const customersList: Customer[] = customersData.customers || [];

      setStats({
        leadsContacted: analyticsData.leads_contacted || 0,
        emailsSent: analyticsData.emails_sent || 0,
        replies: analyticsData.replies || 0,
        opportunities: analyticsData.opportunities || 0,
        replyRate: analyticsData.reply_rate || 0,
      });

      setCustomers(customersList);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    // Reset hasFetched when timeRange changes to allow refetch
    hasFetched.current = false;
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, timeRange]);

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to create customer");

      setNewCustomerName("");
      setIsAddDialogOpen(false);
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesFilter =
      customerFilter === "active" ? customer.is_active !== false : customer.is_active === false;
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const timeRangeLabels: Record<TimeRange, string> = {
    this_week: "This Week",
    this_month: "This Month",
    this_quarter: "This Quarter",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
          <p className="text-muted-foreground text-sm">
            Manage paying customers, workspaces, and campaigns.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-fit">
              {timeRangeLabels[timeRange]}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTimeRange("this_week")}>This Week</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimeRange("this_month")}>This Month</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimeRange("this_quarter")}>This Quarter</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Overview Dashboard */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Overview Dashboard</h2>
              <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
              <span className="text-xs text-muted-foreground">Updates every 30s</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Leads Contacted"
              value={stats.leadsContacted}
              icon={<Users className="h-5 w-5 text-blue-500" />}
              loading={loading}
              href="/admin/leads"
            />
            <StatCard
              label="Emails Sent"
              value={stats.emailsSent}
              icon={<Send className="h-5 w-5 text-emerald-500" />}
              loading={loading}
              href="/admin/leads"
            />
            <StatCard
              label="Replies"
              value={stats.replies}
              icon={<MessageSquareReply className="h-5 w-5 text-purple-500" />}
              loading={loading}
              href="/admin/leads?status=replied"
            />
            <StatCard
              label="Positive Replies"
              value={stats.opportunities}
              icon={<Target className="h-5 w-5 text-green-500" />}
              loading={loading}
              href="/admin/leads?positive=true"
            />
            <StatCard
              label="Reply Rate"
              value={`${stats.replyRate.toFixed(1)}%`}
              icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
              loading={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "customers"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Customers
        </button>
        <Link
          href="/admin/leads"
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
        >
          All Leads
        </Link>
        <Link
          href="/admin/lead-database"
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
        >
          Lead Database
        </Link>
      </div>

      {/* Customers Section */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Filters and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCustomerFilter("active")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  customerFilter === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                Active Customers ({customers.filter((c) => c.is_active !== false).length})
              </button>
              <button
                onClick={() => setCustomerFilter("archived")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  customerFilter === "archived"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                Archived ({customers.filter((c) => c.is_active === false).length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Customer Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter customer name"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateCustomer()}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateCustomer} disabled={isCreating}>
                        {isCreating ? "Creating..." : "Create Customer"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Customers List */}
          <Card>
            <CardContent className="p-0">
              {loading && customers.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "No customers match your search." : "No customers found."}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredCustomers.map((customer) => (
                    <CustomerRow key={customer.id} customer={customer} onRefresh={() => fetchData(true)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer info */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
  href,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const isClickable = href || onClick;
  const content = (
    <div className={`bg-muted rounded-xl p-4 ${isClickable ? "cursor-pointer hover:bg-accent hover:shadow-md transition-all" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-foreground">
        {loading ? (
          <div className="h-8 w-16 bg-accent rounded animate-pulse" />
        ) : typeof value === "number" ? (
          value.toLocaleString()
        ) : (
          value
        )}
      </div>
      {isClickable && (
        <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">Click to view details →</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return content;
}

function CustomerRow({ customer, onRefresh }: { customer: Customer; onRefresh: () => void }) {
  const handleArchive = async () => {
    try {
      await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !customer.is_active }),
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to update customer:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${customer.name}"? This will also delete all their campaigns and leads. This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete customer");
        return;
      }

      onRefresh();
    } catch (error) {
      console.error("Failed to delete customer:", error);
      alert("Failed to delete customer");
    }
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors">
      <Link href={`/admin/clients/${customer.id}`} className="flex-1">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">
              {customer.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-foreground">{customer.name}</p>
            <p className="text-sm text-muted-foreground">
              {customer.campaigns_count || 0} campaigns
              {customer.total_emails_sent > 0 && ` · ${customer.total_emails_sent.toLocaleString()} emails`}
              {customer.reply_rate > 0 && ` · ${customer.reply_rate.toFixed(1)}% reply rate`}
            </p>
          </div>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/clients/${customer.id}`} className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchive} className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            {customer.is_active ? "Archive" : "Restore"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="flex items-center gap-2 text-red-600 focus:text-red-600">
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
