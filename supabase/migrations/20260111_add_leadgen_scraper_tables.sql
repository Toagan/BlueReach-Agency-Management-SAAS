-- LeadGen Scraper Tables
-- These tables store scraped leads from Google Maps and related data

-- Main leads table for scraped business data
CREATE TABLE IF NOT EXISTS leadgen_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id TEXT UNIQUE NOT NULL,  -- Google Maps Place ID (deduplication key)
    name TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating DECIMAL(3,2),
    review_count INTEGER,
    category TEXT,
    categories TEXT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    country TEXT,
    bundesland TEXT,  -- German federal state code (e.g., 'BY', 'NW')
    city TEXT,
    search_term TEXT,
    price_range TEXT,
    opening_hours TEXT,
    description TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_country ON leadgen_leads(country);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_bundesland ON leadgen_leads(bundesland);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_search_term ON leadgen_leads(search_term);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_scraped_at ON leadgen_leads(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_rating ON leadgen_leads(rating DESC);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_website ON leadgen_leads(website) WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_phone ON leadgen_leads(phone) WHERE phone IS NOT NULL;

-- Search templates for saving scraping configurations
CREATE TABLE IF NOT EXISTS leadgen_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    search_terms TEXT[],  -- Array of search terms
    country TEXT DEFAULT 'de',
    bundeslaender TEXT[],  -- Array of state codes
    scrape_mode TEXT DEFAULT 'smart',  -- 'quick', 'smart', 'thorough', 'max'
    min_rating DECIMAL(3,2) DEFAULT 0,
    min_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for templates
CREATE INDEX IF NOT EXISTS idx_leadgen_templates_country ON leadgen_templates(country);

-- Enable Row Level Security
ALTER TABLE leadgen_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leadgen_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow admin access (using service role key bypasses RLS)
-- For authenticated users, only admins can access these tables

CREATE POLICY "Allow admin access to leadgen_leads" ON leadgen_leads
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Allow admin access to leadgen_templates" ON leadgen_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Comments for documentation
COMMENT ON TABLE leadgen_leads IS 'Scraped business leads from Google Maps via Serper API';
COMMENT ON TABLE leadgen_templates IS 'Saved search configurations for the lead scraper';
COMMENT ON COLUMN leadgen_leads.place_id IS 'Unique Google Maps Place ID used for deduplication';
COMMENT ON COLUMN leadgen_leads.bundesland IS 'German federal state code (BY=Bavaria, NW=NRW, etc.)';
