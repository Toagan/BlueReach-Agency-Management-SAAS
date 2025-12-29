"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  MapPin,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface LeadSource {
  id: string;
  name: string;
  file_name: string | null;
  industry: string | null;
  region: string | null;
  sub_region: string | null;
  source_type: string | null;
  scrape_date: string | null;
  tags: string[] | null;
  notes: string | null;
  total_records: number;
  imported_records: number;
  duplicate_records: number;
  created_at: string;
}

interface UploadResult {
  success: boolean;
  stats: {
    total: number;
    imported: number;
    duplicates: number;
    errors: number;
  };
  detectedColumns: string[];
  mappedColumns: string[];
  unmappedColumns: string[];
  errors?: string[];
}

export default function LeadDatabasePage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload dialog state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadIndustry, setUploadIndustry] = useState("");
  const [uploadRegion, setUploadRegion] = useState("");
  const [uploadSourceType, setUploadSourceType] = useState("");
  const [uploadScrapeDate, setUploadScrapeDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/lead-database/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");

      const data = await res.json();
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Set default name from filename
      if (!uploadName) {
        setUploadName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadIndustry("");
    setUploadRegion("");
    setUploadSourceType("");
    setUploadScrapeDate("");
    setUploadResult(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      // Step 1: Create source record
      const createRes = await fetch("/api/admin/lead-database/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName.trim(),
          file_name: uploadFile.name,
          industry: uploadIndustry || null,
          region: uploadRegion || null,
          source_type: uploadSourceType || null,
          scrape_date: uploadScrapeDate || null,
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create source record");
      }

      const { source } = await createRes.json();

      // Step 2: Upload CSV
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("source_id", source.id);
      if (uploadIndustry) formData.append("industry", uploadIndustry);
      if (uploadRegion) formData.append("region", uploadRegion);

      const uploadRes = await fetch("/api/admin/lead-database/upload", {
        method: "POST",
        body: formData,
      });

      const result = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(result.error || "Failed to upload CSV");
      }

      setUploadResult(result);
      fetchSources(); // Refresh the list
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Database</h1>
            <p className="text-muted-foreground text-sm">
              Upload and manage your master lead database
            </p>
          </div>
        </div>

        <Dialog
          open={isUploadDialogOpen}
          onOpenChange={(open) => {
            setIsUploadDialogOpen(open);
            if (!open) resetUploadForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Lead List</DialogTitle>
            </DialogHeader>

            {uploadResult ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-medium">Upload Complete!</span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-muted rounded-lg p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                    <p className="text-2xl font-bold">{uploadResult.stats.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Imported</p>
                    <p className="text-2xl font-bold text-green-600">{uploadResult.stats.imported.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duplicates</p>
                    <p className="text-2xl font-bold text-amber-600">{uploadResult.stats.duplicates.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Errors</p>
                    <p className="text-2xl font-bold text-red-600">{uploadResult.stats.errors}</p>
                  </div>
                </div>

                {uploadResult.unmappedColumns.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Unmapped columns (stored in extra_data):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {uploadResult.unmappedColumns.map((col) => (
                        <Badge key={col} variant="outline" className="text-xs">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Errors:
                    </p>
                    <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                      {uploadResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={() => setIsUploadDialogOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {uploadError && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm">{uploadError}</span>
                  </div>
                )}

                {/* File input */}
                <div className="space-y-2">
                  <Label htmlFor="file">CSV File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="h-8 w-8 text-green-600" />
                        <div className="text-left">
                          <p className="font-medium">{uploadFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(uploadFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click to select or drag and drop
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Batch name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Batch Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., German SaaS Companies Dec 2024"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                  />
                </div>

                {/* Metadata fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      placeholder="e.g., SaaS, E-commerce"
                      value={uploadIndustry}
                      onChange={(e) => setUploadIndustry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      placeholder="e.g., DACH, US, UK"
                      value={uploadRegion}
                      onChange={(e) => setUploadRegion(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sourceType">Source Type</Label>
                    <Select value={uploadSourceType} onValueChange={setUploadSourceType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apollo">Apollo</SelectItem>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="ZoomInfo">ZoomInfo</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scrapeDate">Scrape Date</Label>
                    <Input
                      id="scrapeDate"
                      type="date"
                      value={uploadScrapeDate}
                      onChange={(e) => setUploadScrapeDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!uploadFile || !uploadName.trim() || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Batches</p>
                <p className="text-2xl font-bold">{sources.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">
                  {sources.reduce((sum, s) => sum + s.imported_records, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">
                  {sources.reduce((sum, s) => sum + s.total_records, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Sources list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Upload Batches</span>
            <Button variant="ghost" size="sm" onClick={fetchSources} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && sources.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground font-medium">No lead batches uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click "Upload CSV" to add your first lead list
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">{source.name}</h3>
                      {source.file_name && (
                        <p className="text-sm text-muted-foreground">{source.file_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {source.imported_records.toLocaleString()} leads
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of {source.total_records.toLocaleString()} rows
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {source.industry && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {source.industry}
                      </Badge>
                    )}
                    {source.region && (
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {source.region}
                      </Badge>
                    )}
                    {source.source_type && (
                      <Badge variant="outline" className="text-xs">
                        {source.source_type}
                      </Badge>
                    )}
                    {source.scrape_date && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(source.scrape_date)}
                      </Badge>
                    )}
                    {source.tags && source.tags.length > 0 && source.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Uploaded {formatDate(source.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
