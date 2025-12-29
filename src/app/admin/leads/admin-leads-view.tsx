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
import { Download, ChevronDown } from "lucide-react";
import type { Lead, LeadStatus } from "@/types/database";

interface LeadWithRelations extends Lead {
  // Denormalized fields (preserved even after client/campaign deletion)
  client_id?: string | null;
  client_name?: string | null;
  campaign_name?: string | null;
  // Relations (may be null if deleted)
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

const statusColors: Record<LeadStatus, string> = {
  contacted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  opened: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  clicked: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  replied: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  booked: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  won: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  not_interested: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const totalPages = Math.ceil(totalCount / pageSize);

  // Update URL when filters change
  const updateFilters = (updates: { client?: string; status?: string; positive?: boolean; page?: number }) => {
    const params = new URLSearchParams();

    const newClient = updates.client !== undefined ? updates.client : selectedClient;
    const newStatus = updates.status !== undefined ? updates.status : selectedStatus;
    const newPositive = updates.positive !== undefined ? updates.positive : showPositiveOnly;
    const newPage = updates.page !== undefined ? updates.page : 1; // Reset to page 1 on filter change

    if (newClient && newClient !== "all") params.set("client", newClient);
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    if (newPositive) params.set("positive", "true");
    if (newPage > 1) params.set("page", String(newPage));

    const queryString = params.toString();
    router.push(`/admin/leads${queryString ? `?${queryString}` : ""}`);
  };

  // No client-side filtering needed - data is already filtered server-side
  const filteredLeads = leads;

  // Helper to get client name (uses denormalized field as fallback)
  const getClientName = (lead: LeadWithRelations) => {
    return lead.campaigns?.clients?.name || lead.client_name || "Deleted Client";
  };

  // Helper to get campaign name (uses denormalized field as fallback)
  const getCampaignName = (lead: LeadWithRelations) => {
    return lead.campaigns?.name || lead.campaign_name || "Deleted Campaign";
  };

  // Export leads to CSV
  const exportToCSV = (leadsToExport: LeadWithRelations[], filename: string) => {
    const headers = [
      "Email",
      "First Name",
      "Last Name",
      "Company",
      "Phone",
      "Status",
      "Positive Reply",
      "Client",
      "Campaign",
      "Notes",
      "Created At",
      "Updated At",
    ];

    const rows = leadsToExport.map((lead) => [
      lead.email || "",
      lead.first_name || "",
      lead.last_name || "",
      lead.company_name || "",
      lead.phone || "",
      lead.status || "",
      lead.is_positive_reply ? "Yes" : "No",
      getClientName(lead),
      getCampaignName(lead),
      (lead.notes || "").replace(/"/g, '""'), // Escape quotes
      lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "",
      lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Export function that fetches from API
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

  return (
    <>
      <div className="flex flex-wrap gap-4 mb-4">
        <Select
          value={selectedClient}
          onValueChange={(value) => {
            setSelectedClient(value);
            updateFilters({ client: value });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by client" />
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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="clicked">Clicked</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
          </SelectContent>
        </Select>

        <button
          onClick={() => {
            setShowPositiveOnly(!showPositiveOnly);
            updateFilters({ positive: !showPositiveOnly });
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            showPositiveOnly
              ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700"
              : "bg-muted text-muted-foreground border border-border hover:bg-accent"
          }`}
        >
          {showPositiveOnly ? "Positive Replies Only" : "Show All Replies"}
        </button>

        {(selectedClient !== "all" || selectedStatus !== "all" || showPositiveOnly) && (
          <button
            onClick={() => {
              setSelectedClient("all");
              setSelectedStatus("all");
              setShowPositiveOnly(false);
              router.push("/admin/leads");
            }}
            className="px-4 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          Showing {leads.length} of {totalCount.toLocaleString()} leads
          {totalCount > pageSize && ` (Page ${currentPage} of ${totalPages})`}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export CSV"}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("current")}>
              Current Filter ({totalCount.toLocaleString()} leads)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("positive")}>
              Positive Replies ({positiveCount.toLocaleString()})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("replied")}>
              All Replies ({repliedCount.toLocaleString()})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("no_response")}>
              No Response
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("all")}>
              All Leads ({totalLeads.toLocaleString()})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pos Reply</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsPanelOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{lead.email}</TableCell>
                  <TableCell>{getClientName(lead)}</TableCell>
                  <TableCell>{getCampaignName(lead)}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[lead.status]}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.is_positive_reply ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
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
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => updateFilters({ page: currentPage - 1 })}
            >
              Previous
            </Button>
            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
              if (pageNum > totalPages) return null;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilters({ page: pageNum })}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => updateFilters({ page: currentPage + 1 })}
            >
              Next
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
    </>
  );
}
