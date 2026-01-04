-- Add last_email_sync_at to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS last_email_sync_at timestamptz;

COMMENT ON COLUMN campaigns.last_email_sync_at IS 'Timestamp of the last email history sync from provider';
