-- Leadgen Leads Table for Scraper
-- Run this in Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS leadgen_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  category TEXT,
  categories TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  country TEXT DEFAULT 'de',
  bundesland TEXT,
  city TEXT,
  search_term TEXT,
  price_range TEXT,
  opening_hours TEXT,
  description TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_country ON leadgen_leads(country);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_bundesland ON leadgen_leads(bundesland);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_search_term ON leadgen_leads(search_term);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_scraped_at ON leadgen_leads(scraped_at);
CREATE INDEX IF NOT EXISTS idx_leadgen_leads_place_id ON leadgen_leads(place_id);

-- Enable Row Level Security (optional - disable if using service role key)
-- ALTER TABLE leadgen_leads ENABLE ROW LEVEL SECURITY;

-- Policy for service role to have full access
-- CREATE POLICY "Service role full access" ON leadgen_leads
--   FOR ALL USING (true) WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_leadgen_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leadgen_leads_updated_at
  BEFORE UPDATE ON leadgen_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leadgen_updated_at();
