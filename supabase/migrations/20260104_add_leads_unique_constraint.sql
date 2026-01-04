-- Add UNIQUE constraint on (campaign_id, email) for leads table
-- This is required for the upsert logic in sync-positive endpoint to work correctly

-- First, remove any duplicate entries (keep the most recently updated one)
DELETE FROM leads a
USING leads b
WHERE a.campaign_id = b.campaign_id
  AND LOWER(a.email) = LOWER(b.email)
  AND a.updated_at < b.updated_at;

-- Create the unique index (case-insensitive on email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_campaign_email_unique
ON leads (campaign_id, LOWER(email));

-- Add comment
COMMENT ON INDEX idx_leads_campaign_email_unique IS 'Ensures each email can only appear once per campaign (case-insensitive)';
