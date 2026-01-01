-- ============================================
-- Migration: Add additional Instantly lead fields
-- Date: 2025-01-01
-- Purpose: Store more data from Instantly API
-- ============================================

-- Add new columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_domain text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS personalization text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instantly_created_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_step_info jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_open_count integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_click_count integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_reply_count integer DEFAULT 0;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_company_domain ON leads(company_domain);
CREATE INDEX IF NOT EXISTS idx_leads_last_contacted_at ON leads(last_contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_instantly_created_at ON leads(instantly_created_at DESC);

-- Comments for documentation
COMMENT ON COLUMN leads.company_domain IS 'Company domain extracted by Instantly (e.g., example.com)';
COMMENT ON COLUMN leads.personalization IS 'Personalization/custom intro text from Instantly';
COMMENT ON COLUMN leads.instantly_created_at IS 'When the lead was created in Instantly';
COMMENT ON COLUMN leads.last_contacted_at IS 'When the lead was last contacted (email sent)';
COMMENT ON COLUMN leads.last_step_info IS 'JSON with last email step info (stepID, from, timestamp)';
COMMENT ON COLUMN leads.email_open_count IS 'Number of email opens tracked by Instantly';
COMMENT ON COLUMN leads.email_click_count IS 'Number of link clicks tracked by Instantly';
COMMENT ON COLUMN leads.email_reply_count IS 'Number of replies received from this lead';
