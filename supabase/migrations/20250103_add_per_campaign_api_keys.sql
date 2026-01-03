-- Migration: Add per-campaign API key storage
-- This enables each campaign to have its own API key, supporting multi-provider scenarios
-- where different campaigns under the same client may use different API keys or providers

-- Add new columns to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS api_key_encrypted text,
ADD COLUMN IF NOT EXISTS api_key_label text,
ADD COLUMN IF NOT EXISTS webhook_secret text,
ADD COLUMN IF NOT EXISTS last_lead_sync_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.api_key_encrypted IS 'Encrypted API key for the campaign provider (Instantly/Smartlead)';
COMMENT ON COLUMN campaigns.api_key_label IS 'Optional label to identify which workspace/account this key belongs to';
COMMENT ON COLUMN campaigns.webhook_secret IS 'Per-campaign webhook secret for signature verification';
COMMENT ON COLUMN campaigns.last_lead_sync_at IS 'Timestamp of the last full lead sync from provider';

-- Update email_events table for multi-provider support
ALTER TABLE email_events
ADD COLUMN IF NOT EXISTS provider_type text CHECK (provider_type IN ('instantly', 'smartlead', 'lemlist', 'apollo')),
ADD COLUMN IF NOT EXISTS provider_event_id text;

-- Create index for provider event lookups (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_provider_unique
ON email_events(provider_type, provider_event_id)
WHERE provider_event_id IS NOT NULL;

-- Add provider_lead_id to leads table for multi-provider support
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS provider_type text CHECK (provider_type IN ('instantly', 'smartlead', 'lemlist', 'apollo')),
ADD COLUMN IF NOT EXISTS provider_lead_id text;

-- Create index for provider lead lookups
CREATE INDEX IF NOT EXISTS idx_leads_provider_lookup
ON leads(provider_type, provider_lead_id)
WHERE provider_lead_id IS NOT NULL;

-- Migrate existing data: Set provider_type to 'instantly' for existing records
UPDATE campaigns
SET provider_type = 'instantly'
WHERE provider_type IS NULL AND instantly_campaign_id IS NOT NULL;

UPDATE leads
SET provider_type = 'instantly', provider_lead_id = instantly_lead_id
WHERE provider_type IS NULL AND instantly_lead_id IS NOT NULL;

UPDATE email_events
SET provider_type = 'instantly', provider_event_id = instantly_event_id
WHERE provider_type IS NULL AND instantly_event_id IS NOT NULL;

-- Note: We're not dropping the legacy columns (instantly_campaign_id, instantly_lead_id, instantly_event_id)
-- to maintain backward compatibility. They can be removed in a future migration.
