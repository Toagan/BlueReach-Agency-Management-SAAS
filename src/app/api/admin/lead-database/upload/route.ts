import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Known column mappings (flexible - maps common CSV headers to our schema)
const COLUMN_MAPPINGS: Record<string, string> = {
  // URL/Domain
  url: "url",
  website: "url",
  company_website: "url",
  "company website": "url",
  domain: "url",
  // Email
  email: "email",
  "email address": "email",
  work_email: "email",
  // Name
  first_name: "first_name",
  "first name": "first_name",
  firstname: "first_name",
  last_name: "last_name",
  "last name": "last_name",
  lastname: "last_name",
  full_name: "full_name",
  "full name": "full_name",
  name: "full_name",
  // Job
  title: "job_title",
  job_title: "job_title",
  "job title": "job_title",
  position: "job_title",
  role: "job_title",
  // Company
  company: "company_name",
  company_name: "company_name",
  "company name": "company_name",
  organization: "company_name",
  company_size: "company_size",
  "company size": "company_size",
  employees: "company_size",
  headcount: "company_size",
  revenue: "company_revenue",
  company_revenue: "company_revenue",
  founded: "company_founded",
  year_founded: "company_founded",
  // Location
  country: "country",
  city: "city",
  state: "state",
  region: "state",
  // LinkedIn
  linkedin: "linkedin_url",
  linkedin_url: "linkedin_url",
  "linkedin url": "linkedin_url",
  linkedin_profile: "linkedin_url",
  company_linkedin: "company_linkedin",
  // Phone
  phone: "phone",
  phone_number: "phone",
  "phone number": "phone",
  mobile: "phone",
  // Industry
  industry: "industry",
  sector: "industry",
  sub_industry: "sub_industry",
};

function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Simple CSV parsing (handles quoted values)
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function mapRow(
  headers: string[],
  row: string[],
  sourceId: string,
  batchIndustry?: string,
  batchRegion?: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    source_id: sourceId,
    extra_data: {} as Record<string, string>,
  };

  headers.forEach((header, index) => {
    const value = row[index]?.trim();
    if (!value) return;

    const mappedField = COLUMN_MAPPINGS[header];
    if (mappedField) {
      // Handle special cases
      if (mappedField === "company_founded") {
        const year = parseInt(value);
        if (!isNaN(year) && year > 1800 && year < 2100) {
          result[mappedField] = year;
        }
      } else {
        result[mappedField] = value;
      }
    } else {
      // Store unmapped columns in extra_data
      (result.extra_data as Record<string, string>)[header] = value;
    }
  });

  // Apply batch-level metadata if lead doesn't have it
  if (batchIndustry && !result.industry) {
    result.industry = batchIndustry;
  }

  // Extract domain from URL or email if not set
  if (!result.domain) {
    if (result.url) {
      result.domain = extractDomain(result.url as string);
    } else if (result.email) {
      result.domain = (result.email as string).split("@")[1]?.toLowerCase();
    }
  }

  return result;
}

function extractDomain(url: string): string | null {
  if (!url) return null;
  try {
    let domain = url.toLowerCase();
    domain = domain.replace(/^https?:\/\//, "");
    domain = domain.replace(/^www\./, "");
    domain = domain.split("/")[0];
    domain = domain.split(":")[0];
    return domain || null;
  } catch {
    return null;
  }
}

// POST: Upload and process CSV
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const formData = await request.formData();

    const file = formData.get("file") as File;
    const sourceId = formData.get("source_id") as string;
    const batchIndustry = formData.get("industry") as string | null;
    const batchRegion = formData.get("region") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "Source ID is required" },
        { status: 400 }
      );
    }

    // Read and parse CSV
    const csvText = await file.text();
    const { headers, rows } = parseCSV(csvText);

    if (headers.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty or invalid" },
        { status: 400 }
      );
    }

    // Process rows in batches
    const BATCH_SIZE = 100;
    let imported = 0;
    let duplicates = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const leadsToInsert = batch
        .map((row) => mapRow(headers, row, sourceId, batchIndustry || undefined, batchRegion || undefined))
        .filter((lead) => lead.email || lead.url); // Must have at least email or URL

      if (leadsToInsert.length === 0) continue;

      // Upsert leads (on conflict: domain + email)
      const { data, error } = await supabase
        .from("enriched_leads")
        .upsert(leadsToInsert, {
          onConflict: "domain,email",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) {
        console.error("Batch insert error:", error);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        // Count new vs updated (upsert doesn't distinguish, so we count all as imported)
        imported += data?.length || 0;
      }
    }

    // Update source stats
    await supabase
      .from("lead_sources")
      .update({
        total_records: rows.length,
        imported_records: imported,
        duplicate_records: duplicates,
      })
      .eq("id", sourceId);

    return NextResponse.json({
      success: true,
      stats: {
        total: rows.length,
        imported,
        duplicates,
        errors: errors.length,
      },
      detectedColumns: headers,
      mappedColumns: headers.filter((h) => COLUMN_MAPPINGS[h]),
      unmappedColumns: headers.filter((h) => !COLUMN_MAPPINGS[h]),
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    return NextResponse.json(
      { error: "Failed to process CSV upload" },
      { status: 500 }
    );
  }
}
