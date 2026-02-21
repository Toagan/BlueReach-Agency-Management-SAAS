-- Add idempotency key to webhook_logs for deduplication
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Create unique index for idempotency (campaign_id + idempotency_key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_idempotency
  ON webhook_logs (campaign_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add sync lock columns to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sync_in_progress boolean DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;

-- Create RPC function for atomic campaign counter increments
-- Uses a whitelist to prevent SQL injection via dynamic column name
CREATE OR REPLACE FUNCTION increment_campaign_counter(
  campaign_uuid uuid,
  counter_name text,
  increment_by integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Whitelist allowed counter columns to prevent SQL injection
  IF counter_name NOT IN (
    'cached_emails_sent',
    'cached_emails_bounced',
    'cached_emails_opened',
    'cached_reply_count',
    'cached_leads_count'
  ) THEN
    RAISE EXCEPTION 'Invalid counter name: %', counter_name;
  END IF;

  EXECUTE format(
    'UPDATE campaigns SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    counter_name, counter_name
  )
  USING increment_by, campaign_uuid;
END;
$$;

-- Create or replace the existing increment_campaign_emails_sent function
CREATE OR REPLACE FUNCTION increment_campaign_emails_sent(campaign_uuid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE campaigns
  SET cached_emails_sent = COALESCE(cached_emails_sent, 0) + 1
  WHERE id = campaign_uuid;
END;
$$;
