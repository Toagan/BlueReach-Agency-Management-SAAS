-- ============================================
-- Migration: Master Lead Database
-- Date: 2024-12-30
-- Purpose: Store all scraped/contacted leads with rich metadata
-- ============================================

-- ============================================
-- 1. LEAD SOURCES TABLE (Upload Batches)
-- ============================================
-- Each CSV upload creates a new source with batch-level metadata
CREATE TABLE IF NOT EXISTS lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch identification
  name text NOT NULL, -- e.g., "German SaaS Companies Dec 2024"
  file_name text, -- Original uploaded file name

  -- Batch-level metadata (applies to all leads in this batch)
  industry text, -- e.g., "SaaS", "E-commerce", "Manufacturing"
  region text, -- e.g., "DACH", "US", "UK", "EU"
  sub_region text, -- e.g., "Bavaria", "California"
  source_type text, -- e.g., "Apollo", "LinkedIn", "Manual", "ZoomInfo"
  scrape_date date, -- When the data was scraped

  -- Additional flexible metadata
  tags text[], -- Array of tags for categorization
  notes text,
  custom_fields jsonb DEFAULT '{}', -- Any other metadata

  -- Stats
  total_records integer DEFAULT 0,
  imported_records integer DEFAULT 0,
  duplicate_records integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_sources_created ON lead_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_sources_industry ON lead_sources(industry);
CREATE INDEX IF NOT EXISTS idx_lead_sources_region ON lead_sources(region);

-- ============================================
-- 2. ENRICHED LEADS TABLE (Master Lead Database)
-- ============================================
-- All leads from all sources, with URL as primary company identifier
CREATE TABLE IF NOT EXISTS enriched_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES lead_sources(id) ON DELETE SET NULL,

  -- Primary identifiers
  url text, -- Company website URL (primary matching key, normalized)
  domain text, -- Extracted domain from URL (e.g., "example.com")
  email text,

  -- Person info
  first_name text,
  last_name text,
  full_name text, -- Computed or provided
  job_title text,
  linkedin_url text,
  phone text,

  -- Company info
  company_name text,
  company_size text, -- e.g., "1-10", "11-50", "51-200"
  company_revenue text,
  company_founded integer, -- Year
  company_linkedin text,

  -- Location
  country text,
  city text,
  state text,

  -- Classification (can override source-level)
  industry text,
  sub_industry text,

  -- Flexible data (for any CSV columns we don't have fixed fields for)
  extra_data jsonb DEFAULT '{}',

  -- Status tracking
  contacted_at timestamptz, -- When first contacted (if ever)
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL, -- Link to campaign if contacted
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL, -- Link to campaign lead if exists

  -- Timestamps
  scraped_at timestamptz, -- When this data was scraped
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: one person per company (by URL + name combo)
  UNIQUE(domain, email)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_enriched_leads_domain ON enriched_leads(domain);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_url ON enriched_leads(url);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_email ON enriched_leads(email);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_company ON enriched_leads(company_name);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_source ON enriched_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_industry ON enriched_leads(industry);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_country ON enriched_leads(country);
CREATE INDEX IF NOT EXISTS idx_enriched_leads_name ON enriched_leads(first_name, last_name);

-- Full text search on company and person names
CREATE INDEX IF NOT EXISTS idx_enriched_leads_search ON enriched_leads
  USING gin(to_tsvector('english', coalesce(company_name, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '')));

-- ============================================
-- 3. HELPER FUNCTION: Extract domain from URL
-- ============================================
CREATE OR REPLACE FUNCTION extract_domain(url_input text)
RETURNS text AS $$
DECLARE
  domain_result text;
BEGIN
  IF url_input IS NULL OR url_input = '' THEN
    RETURN NULL;
  END IF;

  -- Remove protocol
  domain_result := regexp_replace(url_input, '^https?://', '', 'i');
  -- Remove www.
  domain_result := regexp_replace(domain_result, '^www\.', '', 'i');
  -- Remove path and query
  domain_result := regexp_replace(domain_result, '/.*$', '');
  -- Remove port
  domain_result := regexp_replace(domain_result, ':\d+$', '');
  -- Lowercase
  domain_result := lower(domain_result);

  RETURN domain_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 4. TRIGGER: Auto-extract domain from URL
-- ============================================
CREATE OR REPLACE FUNCTION set_enriched_lead_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract domain from URL if not provided
  IF NEW.url IS NOT NULL AND (NEW.domain IS NULL OR NEW.domain = '') THEN
    NEW.domain := extract_domain(NEW.url);
  END IF;

  -- Extract domain from email if still no domain
  IF NEW.domain IS NULL AND NEW.email IS NOT NULL THEN
    NEW.domain := lower(split_part(NEW.email, '@', 2));
  END IF;

  -- Compute full name
  IF NEW.full_name IS NULL AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.full_name := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_enriched_lead_domain_trigger ON enriched_leads;
CREATE TRIGGER set_enriched_lead_domain_trigger
  BEFORE INSERT OR UPDATE ON enriched_leads
  FOR EACH ROW
  EXECUTE FUNCTION set_enriched_lead_domain();

-- ============================================
-- 5. UPDATE TRIGGER FOR lead_sources
-- ============================================
DROP TRIGGER IF EXISTS update_lead_sources_updated_at ON lead_sources;
CREATE TRIGGER update_lead_sources_updated_at
  BEFORE UPDATE ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE enriched_leads ENABLE ROW LEVEL SECURITY;

-- Admin only for now (can add client access later)
CREATE POLICY "Admin can manage lead_sources" ON lead_sources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can manage enriched_leads" ON enriched_leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 7. VIEW: Lead with enrichment data
-- ============================================
-- Use this view to get campaign leads with their enriched data
CREATE OR REPLACE VIEW leads_with_enrichment AS
SELECT
  l.*,
  el.industry as enriched_industry,
  el.company_size as enriched_company_size,
  el.country as enriched_country,
  el.city as enriched_city,
  el.job_title as enriched_job_title,
  el.linkedin_url as enriched_linkedin,
  el.extra_data as enriched_extra_data,
  ls.name as source_name,
  ls.region as source_region,
  ls.source_type as source_type
FROM leads l
LEFT JOIN enriched_leads el ON (
  -- Match by email domain
  lower(split_part(l.email, '@', 2)) = el.domain
  AND (
    -- And optionally by name
    (lower(l.first_name) = lower(el.first_name) AND lower(l.last_name) = lower(el.last_name))
    OR el.first_name IS NULL
  )
)
LEFT JOIN lead_sources ls ON el.source_id = ls.id;

-- ============================================
-- 8. COMMENTS
-- ============================================
COMMENT ON TABLE lead_sources IS 'Metadata for CSV upload batches - industry, region, source, etc.';
COMMENT ON TABLE enriched_leads IS 'Master database of all scraped/contacted leads with rich data';
COMMENT ON COLUMN enriched_leads.domain IS 'Normalized domain extracted from URL or email - primary matching key';
COMMENT ON COLUMN enriched_leads.extra_data IS 'Flexible JSONB field for any CSV columns not in fixed schema';
COMMENT ON FUNCTION extract_domain IS 'Extracts and normalizes domain from a URL';
