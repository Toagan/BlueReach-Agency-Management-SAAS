-- ============================================
-- Migration: Add Email Sequences and Threads
-- Date: 2024-12-30
-- Purpose: Store campaign email templates and lead email threads
-- ============================================

-- ============================================
-- 1. API PROVIDERS TABLE (for multi-provider support)
-- ============================================
CREATE TABLE IF NOT EXISTS api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('instantly', 'smartlead', 'lemlist', 'apollo')),
  api_key text NOT NULL,
  workspace_id text, -- Some providers have workspace concepts
  is_active boolean DEFAULT true,
  label text, -- Optional friendly name like "Main Account", "EU Account"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, provider_type, api_key)
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_api_providers_client ON api_providers(client_id);
CREATE INDEX IF NOT EXISTS idx_api_providers_type ON api_providers(provider_type);

-- ============================================
-- 2. UPDATE CAMPAIGNS TABLE
-- ============================================
-- Add provider reference (optional - NULL means use global/default key)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS provider_type text DEFAULT 'instantly';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS provider_campaign_id text; -- Alias for instantly_campaign_id for multi-provider
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS original_name text; -- Store original name from provider
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS copy_body text; -- Store email copy/body for reference

-- Migrate existing data: copy instantly_campaign_id to provider_campaign_id
UPDATE campaigns
SET provider_campaign_id = instantly_campaign_id,
    original_name = name
WHERE instantly_campaign_id IS NOT NULL AND provider_campaign_id IS NULL;

-- Add index for provider lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_provider ON campaigns(provider_type, provider_campaign_id);

-- ============================================
-- 3. CAMPAIGN SEQUENCES TABLE (Email Templates/Steps)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Sequence identification
  sequence_index integer NOT NULL DEFAULT 0, -- 0 = main sequence, 1+ = subsequences
  step_number integer NOT NULL, -- 1, 2, 3... within the sequence
  variant text DEFAULT 'A', -- A, B, C for A/B testing variants

  -- Email content
  subject text,
  body_text text,
  body_html text,

  -- Timing
  delay_days integer DEFAULT 0, -- Days after previous step (0 for first step)
  delay_hours integer DEFAULT 0,
  send_time_start text, -- e.g., "09:00"
  send_time_end text, -- e.g., "17:00"

  -- Metadata
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: one step per position per variant
  UNIQUE(campaign_id, sequence_index, step_number, variant)
);

-- Add indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign ON campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_step ON campaign_sequences(campaign_id, sequence_index, step_number);

-- ============================================
-- 4. LEAD EMAILS TABLE (Actual Sent/Received Emails)
-- ============================================
CREATE TABLE IF NOT EXISTS lead_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Provider identification
  provider_email_id text, -- ID from Instantly/Smartlead
  provider_thread_id text, -- Thread ID from provider

  -- Email metadata
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_email text NOT NULL,
  to_email text NOT NULL,
  cc_emails text[], -- Array of CC addresses
  bcc_emails text[], -- Array of BCC addresses

  -- Email content
  subject text,
  body_text text,
  body_html text,

  -- Tracking
  sequence_step integer, -- Which step in the sequence this was (for outbound)
  is_auto_reply boolean DEFAULT false, -- Auto-reply detection

  -- Timestamps
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,

  -- Metadata
  raw_headers jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),

  -- Unique constraint on provider email ID
  UNIQUE(provider_email_id)
);

-- Add indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_lead_emails_lead ON lead_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_emails_campaign ON lead_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_emails_thread ON lead_emails(provider_thread_id);
CREATE INDEX IF NOT EXISTS idx_lead_emails_sent_at ON lead_emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_emails_direction ON lead_emails(direction);

-- ============================================
-- 5. UPDATE FUNCTIONS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_api_providers_updated_at ON api_providers;
CREATE TRIGGER update_api_providers_updated_at
    BEFORE UPDATE ON api_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_sequences_updated_at ON campaign_sequences;
CREATE TRIGGER update_campaign_sequences_updated_at
    BEFORE UPDATE ON campaign_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_emails ENABLE ROW LEVEL SECURITY;

-- API Providers policies (admin only)
CREATE POLICY "Admin can manage api_providers" ON api_providers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Campaign Sequences policies
CREATE POLICY "Admin can manage campaign_sequences" ON campaign_sequences
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Clients can view own campaign_sequences" ON campaign_sequences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN client_users cu ON cu.client_id = c.client_id
      WHERE c.id = campaign_sequences.campaign_id
      AND cu.user_id = auth.uid()
    )
  );

-- Lead Emails policies
CREATE POLICY "Admin can manage lead_emails" ON lead_emails
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Clients can view own lead_emails" ON lead_emails
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      JOIN campaigns c ON c.id = l.campaign_id
      JOIN client_users cu ON cu.client_id = c.client_id
      WHERE l.id = lead_emails.lead_id
      AND cu.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. HELPFUL VIEWS
-- ============================================

-- View: Campaign with sequence count
CREATE OR REPLACE VIEW campaign_with_sequences AS
SELECT
  c.*,
  COUNT(DISTINCT cs.id) as sequence_count,
  COUNT(DISTINCT cs.variant) as variant_count,
  MAX(cs.step_number) as max_steps
FROM campaigns c
LEFT JOIN campaign_sequences cs ON cs.campaign_id = c.id
GROUP BY c.id;

-- View: Lead with email thread summary
CREATE OR REPLACE VIEW lead_email_summary AS
SELECT
  l.id as lead_id,
  l.email as lead_email,
  l.campaign_id,
  COUNT(le.id) as total_emails,
  COUNT(CASE WHEN le.direction = 'outbound' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN le.direction = 'inbound' THEN 1 END) as emails_received,
  MIN(le.sent_at) as first_email_at,
  MAX(le.sent_at) as last_email_at,
  MAX(CASE WHEN le.direction = 'inbound' THEN le.sent_at END) as last_reply_at
FROM leads l
LEFT JOIN lead_emails le ON le.lead_id = l.id
GROUP BY l.id, l.email, l.campaign_id;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE api_providers IS 'Stores API keys for different email providers (Instantly, Smartlead, etc.) per client';
COMMENT ON TABLE campaign_sequences IS 'Stores email template steps and A/B variants for each campaign';
COMMENT ON TABLE lead_emails IS 'Stores the actual email messages sent to and received from leads';

COMMENT ON COLUMN campaigns.provider_campaign_id IS 'The campaign ID from the provider (Instantly, Smartlead, etc.)';
COMMENT ON COLUMN campaigns.original_name IS 'The original campaign name from the provider, preserved for reference';
COMMENT ON COLUMN campaigns.name IS 'User-editable display name, can be changed without breaking provider association';

COMMENT ON COLUMN campaign_sequences.sequence_index IS '0 = main sequence, 1+ = subsequences/follow-ups';
COMMENT ON COLUMN campaign_sequences.variant IS 'A/B testing variant identifier (A, B, C, etc.)';

COMMENT ON COLUMN lead_emails.direction IS 'outbound = sent to lead, inbound = received from lead';
COMMENT ON COLUMN lead_emails.sequence_step IS 'Which step in the campaign sequence this email was (for outbound only)';
