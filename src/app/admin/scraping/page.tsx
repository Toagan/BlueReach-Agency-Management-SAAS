"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Search,
  ArrowLeft,
  Play,
  Square,
  Download,
  RefreshCw,
  Database,
  Clock,
  FileText,
  Settings,
  Terminal,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  List,
  Layers,
} from "lucide-react";

// Types
interface JobStatus {
  is_running: boolean;
  current_city: string;
  total_leads: number;
  total_skipped: number;
  status_message: string;
  new_logs: string[];
  all_logs: string[];  // Complete log history for reconnection
  current_filename: string;
  start_time: number | null;
  processed_locations: number;
  total_locations: number;
  leads_per_minute: number;
  eta_minutes: number;
}

interface HistoryEntry {
  timestamp: number;
  date: string;
  term: string;
  region: string;
  leads_requested: number;
  filename: string;
}

interface Category {
  key: string;
  name: string;
  query_count: number;
  queries: string[];
}

interface Country {
  code: string;
  name: string;
  has_cities: boolean;
}

interface Bundesland {
  code: string;
  name: string;
}

interface DbStats {
  total_leads: number;
  by_country: Record<string, number>;
  last_24h: number;
}

// Scraper API base URL - configurable via environment
// Fallback to Railway scraper URL if env var not set at build time
const SCRAPER_API_URL = process.env.NEXT_PUBLIC_SCRAPER_API_URL || "https://enchanting-patience-production-6a3e.up.railway.app";

export default function ScrapingPage() {
  // State
  const [activeTab, setActiveTab] = useState("single");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Job status
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Form state - Single Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("de");
  const [numLeads, setNumLeads] = useState("500");
  const [scrapeMode, setScrapeMode] = useState("smart");
  const [minRating, setMinRating] = useState("0");
  const [minReviews, setMinReviews] = useState("0");
  const [selectedCategory, setSelectedCategory] = useState<string>("custom");
  const [expandQueries, setExpandQueries] = useState(false);
  const [selectedBundeslaender, setSelectedBundeslaender] = useState<string[]>([]);

  // Form state - Bulk Keywords
  const [bulkKeywords, setBulkKeywords] = useState("");

  // Form state - Batch Search
  const [batchCountries, setBatchCountries] = useState<string[]>([]);
  const [leadsPerTerm, setLeadsPerTerm] = useState("50");

  // Configure Countries state
  const [countrySearchTerms, setCountrySearchTerms] = useState<Record<string, string[]>>({});
  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const [editTermsText, setEditTermsText] = useState("");

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [bundeslaender, setBundeslaender] = useState<Bundesland[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);

  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Start/stop polling based on job status
  useEffect(() => {
    if (jobStatus?.is_running && !isPolling) {
      startPolling();
    } else if (!jobStatus?.is_running && isPolling) {
      stopPolling();
    }
  }, [jobStatus?.is_running]);

  const checkConnection = async () => {
    try {
      const res = await fetch(`${SCRAPER_API_URL}/`);
      const data = await res.json();
      setIsConnected(data.status === "ok");
    } catch {
      setIsConnected(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [catRes, countryRes, blRes, termsRes] = await Promise.all([
        fetch(`${SCRAPER_API_URL}/categories`),
        fetch(`${SCRAPER_API_URL}/countries`),
        fetch(`${SCRAPER_API_URL}/bundeslaender`),
        fetch(`${SCRAPER_API_URL}/search-terms`),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (countryRes.ok) setCountries(await countryRes.json());
      if (blRes.ok) setBundeslaender(await blRes.json());
      if (termsRes.ok) setCountrySearchTerms(await termsRes.json());
    } catch (err) {
      console.error("Error fetching reference data:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${SCRAPER_API_URL}/history`);
      if (res.ok) setHistory(await res.json());
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const fetchDbStats = async () => {
    try {
      const res = await fetch(`${SCRAPER_API_URL}/api/db/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setDbStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Error fetching DB stats:", err);
    }
  };

  const startPolling = useCallback(() => {
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${SCRAPER_API_URL}/status`);
        if (res.ok) {
          const status: JobStatus = await res.json();
          setJobStatus(status);
          if (status.new_logs && status.new_logs.length > 0) {
            setLogs(prev => [...prev, ...status.new_logs]);
          }
          if (!status.is_running) {
            stopPolling();
            fetchHistory();
            fetchDbStats();
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1000);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Check for running job on mount (reconnect after page reload)
  useEffect(() => {
    const checkRunningJob = async () => {
      try {
        const res = await fetch(`${SCRAPER_API_URL}/status`);
        if (res.ok) {
          const status: JobStatus = await res.json();
          setJobStatus(status);
          if (status.is_running) {
            // Job is already running - reconnect with full log history
            const reconnectLogs = status.all_logs && status.all_logs.length > 0
              ? ["--- Reconnected to running job ---", ...status.all_logs]
              : ["Reconnected to running job..."];
            setLogs(reconnectLogs);
            startPolling();
          }
        }
      } catch (err) {
        console.error("Error checking job status:", err);
      }
    };

    checkRunningJob();
    checkConnection();
    fetchReferenceData();
    fetchHistory();
    fetchDbStats();
  }, [startPolling]);

  // Start Single Search
  const handleStartSingleSearch = async () => {
    if (!searchTerm && selectedCategory === "custom") {
      alert("Please enter a search term or select a category");
      return;
    }

    setIsStarting(true);
    setLogs([]);
    try {
      const res = await fetch(`${SCRAPER_API_URL}/run-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_term: searchTerm,
          region: selectedCountry,
          num_leads: parseInt(numLeads),
          match_type: "literal",
          min_rating: parseFloat(minRating),
          min_reviews: parseInt(minReviews),
          scrape_mode: scrapeMode,
          bundeslaender: selectedBundeslaender,
          category: selectedCategory !== "custom" ? selectedCategory : null,
          expand_queries: expandQueries,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setLogs(["Starting scrape..."]);
        startPolling();
      } else {
        alert(data.message || "Failed to start scrape");
      }
    } catch (err) {
      console.error("Error starting scrape:", err);
      alert("Failed to connect to scraper service");
    } finally {
      setIsStarting(false);
    }
  };

  // Start Bulk Keywords
  const handleStartBulkKeywords = async () => {
    const keywords = bulkKeywords.split("\n").map(k => k.trim()).filter(k => k);
    if (keywords.length === 0) {
      alert("Please enter at least one keyword");
      return;
    }

    setIsStarting(true);
    setLogs([]);
    try {
      const res = await fetch(`${SCRAPER_API_URL}/run-bulk-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          region: selectedCountry,
          num_leads: parseInt(numLeads),
          min_rating: parseFloat(minRating),
          min_reviews: parseInt(minReviews),
          scrape_mode: scrapeMode,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setLogs(["Starting bulk keyword scrape..."]);
        startPolling();
      } else {
        alert(data.message || "Failed to start bulk scrape");
      }
    } catch (err) {
      console.error("Error starting bulk scrape:", err);
      alert("Failed to connect to scraper service");
    } finally {
      setIsStarting(false);
    }
  };

  // Start Batch Search
  const handleStartBatchSearch = async () => {
    if (batchCountries.length === 0) {
      alert("Please select at least one country");
      return;
    }

    setIsStarting(true);
    setLogs([]);
    try {
      const res = await fetch(`${SCRAPER_API_URL}/run-batch-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countries: batchCountries,
          num_leads_per_term: parseInt(leadsPerTerm),
          match_type: "literal",
          min_rating: parseFloat(minRating),
          min_reviews: parseInt(minReviews),
          scrape_mode: scrapeMode,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setLogs(["Starting batch scrape..."]);
        startPolling();
      } else {
        alert(data.message || "Failed to start batch scrape");
      }
    } catch (err) {
      console.error("Error starting batch scrape:", err);
      alert("Failed to connect to scraper service");
    } finally {
      setIsStarting(false);
    }
  };

  // Stop scrape
  const handleStop = async () => {
    try {
      await fetch(`${SCRAPER_API_URL}/stop`, { method: "POST" });
    } catch (err) {
      console.error("Error stopping scrape:", err);
    }
  };

  // Save country search terms
  const handleSaveCountryTerms = async (country: string) => {
    const terms = editTermsText.split("\n").map(t => t.trim()).filter(t => t);
    try {
      const res = await fetch(`${SCRAPER_API_URL}/search-terms/${country}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      });
      if (res.ok) {
        setCountrySearchTerms(prev => ({ ...prev, [country]: terms }));
        setEditingCountry(null);
      }
    } catch (err) {
      console.error("Error saving terms:", err);
    }
  };

  // Download file
  const handleDownload = (filename: string, filter?: string) => {
    const url = filter
      ? `${SCRAPER_API_URL}/download/${filename}?filter=${filter}`
      : `${SCRAPER_API_URL}/download/${filename}`;
    window.open(url, "_blank");
  };

  // Export database
  const handleExportDb = (filters?: { country?: string; hasWebsite?: boolean; hasPhone?: boolean }) => {
    let url = `${SCRAPER_API_URL}/api/db/export`;
    const params = new URLSearchParams();
    if (filters?.country) params.set("country", filters.country);
    if (filters?.hasWebsite) params.set("has_website", "true");
    if (filters?.hasPhone) params.set("has_phone", "true");
    if (params.toString()) url += `?${params.toString()}`;
    window.open(url, "_blank");
  };

  const toggleBundesland = (code: string) => {
    setSelectedBundeslaender(prev =>
      prev.includes(code) ? prev.filter(b => b !== code) : [...prev, code]
    );
  };

  const toggleBatchCountry = (code: string) => {
    setBatchCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Progress percentage
  const progressPercent = jobStatus?.total_locations
    ? Math.round((jobStatus.processed_locations / jobStatus.total_locations) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Center
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Lead Scraping</h1>
          <p className="text-muted-foreground">
            Extract leads from Google Maps using Serper API
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected === null ? (
            <Badge variant="secondary">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Checking...
            </Badge>
          ) : isConnected ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Scraper Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Scraper Offline
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={checkConnection}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection Warning */}
      {isConnected === false && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">
              Cannot connect to the scraper service at <code className="bg-destructive/20 px-1 rounded">{SCRAPER_API_URL}</code>.
              Make sure the Flask scraper is running.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Panel - Scraping Controls */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="single" className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                Single
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-1">
                <List className="h-4 w-4" />
                Bulk
              </TabsTrigger>
              <TabsTrigger value="batch" className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                Batch
              </TabsTrigger>
              <TabsTrigger value="configure" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                Configure
              </TabsTrigger>
            </TabsList>

            {/* Single Search Tab */}
            <TabsContent value="single">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-500" />
                    Single Search
                  </CardTitle>
                  <CardDescription>
                    Search for businesses by keyword or category
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search Term or Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Search Term</Label>
                      <Input
                        placeholder="e.g., Marketing Agency"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={selectedCategory !== "custom"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Or Select Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose category bundle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom Search</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.key} value={cat.key}>
                              {cat.name} ({cat.query_count} queries)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Country and Mode */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scrape Mode</Label>
                      <Select value={scrapeMode} onValueChange={setScrapeMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick">Quick (~240 cities)</SelectItem>
                          <SelectItem value="smart">Smart (~1,700 cities)</SelectItem>
                          <SelectItem value="thorough">Thorough (~2,900 cities)</SelectItem>
                          {selectedCountry === "de" && (
                            <SelectItem value="max">Maximum (PLZ grid)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Leads</Label>
                      <Input
                        type="number"
                        value={numLeads}
                        onChange={(e) => setNumLeads(e.target.value)}
                        min="1"
                        max="100000"
                      />
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Rating</Label>
                      <Select value={minRating} onValueChange={setMinRating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Any Rating</SelectItem>
                          <SelectItem value="3">3+ Stars</SelectItem>
                          <SelectItem value="3.5">3.5+ Stars</SelectItem>
                          <SelectItem value="4">4+ Stars</SelectItem>
                          <SelectItem value="4.5">4.5+ Stars</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Min Reviews</Label>
                      <Select value={minReviews} onValueChange={setMinReviews}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Any</SelectItem>
                          <SelectItem value="5">5+ Reviews</SelectItem>
                          <SelectItem value="10">10+ Reviews</SelectItem>
                          <SelectItem value="25">25+ Reviews</SelectItem>
                          <SelectItem value="50">50+ Reviews</SelectItem>
                          <SelectItem value="100">100+ Reviews</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Germany-specific: Bundesland Filter */}
                  {selectedCountry === "de" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Filter by States</Label>
                        {selectedBundeslaender.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedBundeslaender([])}
                          >
                            Clear ({selectedBundeslaender.length})
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {bundeslaender.map(bl => (
                          <Badge
                            key={bl.code}
                            variant={selectedBundeslaender.includes(bl.code) ? "default" : "outline"}
                            className={`cursor-pointer text-xs py-0.5 px-2 ${
                              selectedBundeslaender.includes(bl.code)
                                ? ""
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => toggleBundesland(bl.code)}
                          >
                            {bl.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expand Queries Option */}
                  {selectedCategory === "custom" && selectedCountry === "de" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="expand"
                        checked={expandQueries}
                        onCheckedChange={(checked) => setExpandQueries(!!checked)}
                      />
                      <Label htmlFor="expand" className="text-sm">
                        Expand queries with German translations
                      </Label>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex gap-2">
                    {jobStatus?.is_running ? (
                      <Button variant="destructive" onClick={handleStop} className="flex-1">
                        <Square className="h-4 w-4 mr-2" />
                        Stop Scraping
                      </Button>
                    ) : (
                      <Button onClick={handleStartSingleSearch} disabled={!isConnected || isStarting} className="flex-1">
                        {isStarting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {isStarting ? "Starting..." : "Start Scraping"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bulk Keywords Tab */}
            <TabsContent value="bulk">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <List className="h-5 w-5 text-blue-500" />
                    Bulk Keywords
                  </CardTitle>
                  <CardDescription>
                    Search multiple keywords with global deduplication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Keywords (one per line)</Label>
                    <Textarea
                      placeholder={`Marketing Agency\nWerbeagentur\nDigital Agency\nSEO Agency`}
                      value={bulkKeywords}
                      onChange={(e) => setBulkKeywords(e.target.value)}
                      rows={8}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map(c => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scrape Mode</Label>
                      <Select value={scrapeMode} onValueChange={setScrapeMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick">Quick</SelectItem>
                          <SelectItem value="smart">Smart</SelectItem>
                          <SelectItem value="thorough">Thorough</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Total Leads</Label>
                      <Input
                        type="number"
                        value={numLeads}
                        onChange={(e) => setNumLeads(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {jobStatus?.is_running ? (
                      <Button variant="destructive" onClick={handleStop} className="flex-1">
                        <Square className="h-4 w-4 mr-2" />
                        Stop Scraping
                      </Button>
                    ) : (
                      <Button onClick={handleStartBulkKeywords} disabled={!isConnected || isStarting} className="flex-1">
                        {isStarting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {isStarting ? "Starting..." : "Start Bulk Scrape"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Batch Search Tab */}
            <TabsContent value="batch">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5 text-green-500" />
                    Batch Search
                  </CardTitle>
                  <CardDescription>
                    Run pre-configured searches across multiple countries
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Countries</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {countries.map(c => {
                        const termCount = countrySearchTerms[c.code]?.length || 0;
                        return (
                          <div
                            key={c.code}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              batchCountries.includes(c.code)
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => toggleBatchCountry(c.code)}
                          >
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {termCount} search term{termCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Leads per Term</Label>
                      <Input
                        type="number"
                        value={leadsPerTerm}
                        onChange={(e) => setLeadsPerTerm(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scrape Mode</Label>
                      <Select value={scrapeMode} onValueChange={setScrapeMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick">Quick</SelectItem>
                          <SelectItem value="smart">Smart</SelectItem>
                          <SelectItem value="thorough">Thorough</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {jobStatus?.is_running ? (
                      <Button variant="destructive" onClick={handleStop} className="flex-1">
                        <Square className="h-4 w-4 mr-2" />
                        Stop Scraping
                      </Button>
                    ) : (
                      <Button
                        onClick={handleStartBatchSearch}
                        disabled={!isConnected || batchCountries.length === 0 || isStarting}
                        className="flex-1"
                      >
                        {isStarting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {isStarting ? "Starting..." : `Start Batch Scrape (${batchCountries.length} countries)`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configure Countries Tab */}
            <TabsContent value="configure">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-purple-500" />
                    Configure Search Terms
                  </CardTitle>
                  <CardDescription>
                    Set up search terms for each country (used in batch search)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {countries.map(country => {
                    const terms = countrySearchTerms[country.code] || [];
                    const isEditing = editingCountry === country.code;

                    return (
                      <div key={country.code} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{country.name}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{terms.length} terms</Badge>
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveCountryTerms(country.code)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingCountry(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCountry(country.code);
                                  setEditTermsText(terms.join("\n"));
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <Textarea
                            value={editTermsText}
                            onChange={(e) => setEditTermsText(e.target.value)}
                            placeholder="Enter search terms (one per line)"
                            rows={5}
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {terms.length > 0 ? terms.join(", ") : "No search terms configured"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Progress & Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Live Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              {jobStatus?.is_running && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{jobStatus.current_city || "Starting..."}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {jobStatus.total_leads} leads found
                      {jobStatus.total_skipped > 0 && ` (${jobStatus.total_skipped} filtered)`}
                    </span>
                    <span>
                      {jobStatus.leads_per_minute > 0 && `${jobStatus.leads_per_minute}/min`}
                      {jobStatus.eta_minutes > 0 && ` • ETA: ${Math.round(jobStatus.eta_minutes)} min`}
                    </span>
                  </div>
                </div>
              )}

              {/* Logs Terminal */}
              <div className="bg-zinc-950 text-zinc-100 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-zinc-500">Waiting for scrape to start...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="py-0.5">
                      <span className="text-zinc-500">[{i + 1}]</span> {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Database Stats */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={fetchDbStats}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {dbStats ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{dbStats.total_leads.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Total Leads</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-500">+{dbStats.last_24h.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Last 24h</div>
                    </div>
                  </div>

                  {Object.entries(dbStats.by_country).length > 0 && (
                    <div className="text-xs space-y-1">
                      {Object.entries(dbStats.by_country).slice(0, 3).map(([code, count]) => (
                        <div key={code} className="flex justify-between text-muted-foreground">
                          <span className="uppercase">{code}</span>
                          <span>{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1.5">
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleExportDb()}>
                      <Download className="h-3 w-3 mr-1" />
                      All
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleExportDb({ hasWebsite: true })}>
                      <Globe className="h-3 w-3 mr-1" />
                      Web
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleExportDb({ hasPhone: true })}>
                      <Download className="h-3 w-3 mr-1" />
                      Phone
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-3 text-sm">
                  {isConnected === false ? "Scraper offline" : "Loading..."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Scrapes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-3 text-sm">
                  No scraping history yet
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate" title={entry.term}>
                          {entry.term.replace(/"/g, '')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.region.toUpperCase()} • {entry.leads_requested} leads
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 ml-2"
                        onClick={() => handleDownload(entry.filename)}
                        title="Download CSV"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
