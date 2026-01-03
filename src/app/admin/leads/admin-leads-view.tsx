"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { createClient } from "@/lib/supabase/client";
import {
  Download,
  ChevronDown,
  Search,
  Users,
  ThumbsUp,
  MessageSquare,
  Filter,
  X,
  Mail,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import type { Lead, LeadStatus } from "@/types/database";

interface LeadWithRelations extends Lead {
  client_id?: string | null;
  client_name?: string | null;
  campaign_name?: string | null;
  campaigns: {
    name: string;
    client_id: string;
    clients: { name: string } | null;
  } | null;
}

interface AdminLeadsViewProps {
  leads: LeadWithRelations[];
  clients: Array<{ id: string; name: string }>;
  totalCount: number;
  totalLeads: number;
  positiveCount: number;
  repliedCount: number;
  currentPage: number;
  pageSize: number;
  initialStatus?: string;
  initialClient?: string;
  initialPositive?: boolean;
}

const statusConfig: Record<LeadStatus, { label: string; color: string; icon?: string }> = {
  contacted: { label: "Contacted", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  opened: { label: "Opened", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  clicked: { label: "Clicked", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  replied: { label: "Replied", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  booked: { label: "Booked", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  won: { label: "Won", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  lost: { label: "Lost", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  not_interested: { label: "Not Interested", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export function AdminLeadsView({
  leads,
  clients,
  totalCount,
  totalLeads,
  positiveCount,
  repliedCount,
  currentPage,
  pageSize,
  initialStatus,
  initialClient,
  initialPositive,
}: AdminLeadsViewProps) {
  const [selectedClient, setSelectedClient] = useState<string>(initialClient || "all");
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus || "all");
  const [showPositiveOnly, setShowPositiveOnly] = useState<boolean>(initialPositive || false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasActiveFilters = selectedClient !== "all" || selectedStatus !== "all" || showPositiveOnly;

  const updateFilters = (updates: { client?: string; status?: string; positive?: boolean; page?: number }) => {
    const params = new URLSearchParams();

    const newClient = updates.client !== undefined ? updates.client : selectedClient;
    const newStatus = updates.status !== undefined ? updates.status : selectedStatus;
    const newPositive = updates.positive !== undefined ? updates.positive : showPositiveOnly;
    const newPage = updates.page !== undefined ? updates.page : 1;

    if (newClient && newClient !== "all") params.set("client", newClient);
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    if (newPositive) params.set("positive", "true");
    if (newPage > 1) params.set("page", String(newPage));

    const queryString = params.toString();
    router.push(`/admin/leads${queryString ? `?${queryString}` : ""}`);
  };

  // Client-side search filter
  const filteredLeads = searchQuery
    ? leads.filter(lead =>
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leads;

  const getClientName = (lead: LeadWithRelations) => {
    return lead.campaigns?.clients?.name || lead.client_name || "Unknown";
  };

  const getCampaignName = (lead: LeadWithRelations) => {
    return lead.campaigns?.name || lead.campaign_name || "Unknown";
  };

  const handleExport = async (type: "current" | "positive" | "replied" | "no_response" | "all") => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("export", type);
      if (type === "current") {
        if (selectedClient !== "all") params.set("client", selectedClient);
        if (selectedStatus !== "all") params.set("status", selectedStatus);
        if (showPositiveOnly) params.set("positive", "true");
      }

      const res = await fetch(`/api/admin/leads/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}_leads_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (selectedLead?.id === leadId) {
      setSelectedLead({ ...selectedLead, status });
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const handleNotesChange = async (leadId: string, notes: string) => {
    await supabase
      .from("leads")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (selectedLead?.id === leadId) {
      setSelectedLead({ ...selectedLead, notes });
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const clearFilters = () => {
    setSelectedClient("all");
    setSelectedStatus("all");
    setShowPositiveOnly(false);
    setSearchQuery("");
    router.push("/admin/leads");
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                <Users className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalLeads.toLocaleString()}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{repliedCount.toLocaleString()}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Replied</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{positiveCount.toLocaleString()}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Positive Replies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {totalLeads > 0 ? ((positiveCount / totalLeads) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          <Select
            value={selectedClient}
            onValueChange={(value) => {
              setSelectedClient(value);
              updateFilters({ client: value });
            }}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedStatus}
            onValueChange={(value) => {
              setSelectedStatus(value);
              updateFilters({ status: value });
            }}
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showPositiveOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowPositiveOnly(!showPositiveOnly);
              updateFilters({ positive: !showPositiveOnly });
            }}
            className={showPositiveOnly ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Positive Only
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Export Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting} className="ml-auto">
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export"}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleExport("current")}>
              <span className="flex-1">Current View</span>
              <span className="text-muted-foreground text-xs">{totalCount.toLocaleString()}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("positive")}>
              <span className="flex-1">Positive Replies</span>
              <span className="text-muted-foreground text-xs">{positiveCount.toLocaleString()}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("replied")}>
              <span className="flex-1">All Replies</span>
              <span className="text-muted-foreground text-xs">{repliedCount.toLocaleString()}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("all")}>
              <span className="flex-1">All Leads</span>
              <span className="text-muted-foreground text-xs">{totalLeads.toLocaleString()}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredLeads.length}</span> of{" "}
          <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> leads
          {searchQuery && " (filtered by search)"}
        </p>
        {totalPages > 1 && (
          <p className="text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Lead</TableHead>
              <TableHead className="font-semibold">Client</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">Campaign</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-center">Positive</TableHead>
              <TableHead className="font-semibold text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-50" />
                    <p>No leads found</p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsPanelOpen(true);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[200px] sm:max-w-[280px]" title={lead.email}>
                          {lead.email}
                        </p>
                        {(lead.first_name || lead.company_name) && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[280px]">
                            {lead.first_name && lead.last_name
                              ? `${lead.first_name} ${lead.last_name}`
                              : lead.first_name}
                            {lead.first_name && lead.company_name && " · "}
                            {lead.company_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[120px]" title={getClientName(lead)}>
                        {getClientName(lead)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground truncate block max-w-[200px]" title={getCampaignName(lead)}>
                      {getCampaignName(lead)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusConfig[lead.status]?.color || "bg-gray-100"} font-medium`}>
                      {statusConfig[lead.status]?.label || lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {lead.is_positive_reply ? (
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-900">
                        <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(lead.updated_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => updateFilters({ page: currentPage - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>

            {/* Page numbers */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    className="w-9"
                    onClick={() => updateFilters({ page: pageNum })}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            {/* Mobile: current page indicator */}
            <span className="sm:hidden text-sm text-muted-foreground px-2">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => updateFilters({ page: currentPage + 1 })}
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <LeadDetailPanel
        lead={selectedLead}
        open={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
      />
    </div>
  );
}
