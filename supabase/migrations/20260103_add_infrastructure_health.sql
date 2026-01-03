-- ============================================
-- INFRASTRUCTURE HEALTH TABLES
-- Date: 2026-01-03
-- Purpose: Store email accounts, DNS health, and historical metrics
-- ============================================

-- ============================================
-- 1. EMAIL ACCOUNTS TABLE (Central account registry)
-- ============================================
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identification
  provider_type TEXT NOT NULL CHECK (provider_type IN ('instantly', 'smartlead')),
  provider_account_id TEXT, -- ID from the provider (e.g., Smartlead numeric ID)
  email TEXT NOT NULL,

  -- Client assignment (manual mapping by admin)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Account metadata
  first_name TEXT,
  last_name TEXT,
  domain TEXT GENERATED ALWAYS AS (SPLIT_PART(email, '@', 2)) STORED,

  -- Status fields
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected', 'paused')),
  error_message TEXT,

  -- Warmup fields
  warmup_enabled BOOLEAN DEFAULT false,
  warmup_reputation INTEGER, -- 0-100
  warmup_emails_sent INTEGER DEFAULT 0,
  warmup_emails_received INTEGER DEFAULT 0,
  warmup_saved_from_spam INTEGER DEFAULT 0,

  -- Sending configuration
  daily_limit INTEGER,
  emails_sent_today INTEGER DEFAULT 0,

  -- Timestamps
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint per provider
  UNIQUE(provider_type, email)
);

-- Indexes for email_accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_client ON email_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_domain ON email_accounts(domain);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider_type);
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON email_accounts(status);

-- ============================================
-- 2. EMAIL ACCOUNT HEALTH HISTORY (Daily snapshots)
-- ============================================
CREATE TABLE IF NOT EXISTS email_account_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Snapshot date (one record per account per day)
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Status at snapshot time
  status TEXT,
  warmup_reputation INTEGER,
  warmup_emails_sent INTEGER,
  warmup_emails_received INTEGER,

  -- Daily sending metrics
  emails_sent_today INTEGER DEFAULT 0,
  emails_bounced_today INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),

  -- One snapshot per account per day
  UNIQUE(email_account_id, snapshot_date)
);

-- Indexes for health history
CREATE INDEX IF NOT EXISTS idx_health_history_date ON email_account_health_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_history_account ON email_account_health_history(email_account_id, snapshot_date DESC);

-- ============================================
-- 3. DOMAIN HEALTH TABLE (DNS validation cache)
-- ============================================
CREATE TABLE IF NOT EXISTS domain_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,

  -- SPF Record
  has_spf BOOLEAN DEFAULT false,
  spf_record TEXT,
  spf_valid BOOLEAN DEFAULT false,

  -- DKIM Record
  has_dkim BOOLEAN DEFAULT false,
  dkim_selector TEXT, -- e.g., 'google', 'default'
  dkim_record TEXT,
  dkim_valid BOOLEAN DEFAULT false,

  -- DMARC Record
  has_dmarc BOOLEAN DEFAULT false,
  dmarc_record TEXT,
  dmarc_policy TEXT CHECK (dmarc_policy IS NULL OR dmarc_policy IN ('none', 'quarantine', 'reject')),
  dmarc_valid BOOLEAN DEFAULT false,

  -- Overall health score (0-100)
  health_score INTEGER DEFAULT 0,

  -- Timestamps
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for domain lookups
CREATE INDEX IF NOT EXISTS idx_domain_health_score ON domain_health(health_score);

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Updated at trigger for email_accounts
DROP TRIGGER IF EXISTS update_email_accounts_updated_at ON email_accounts;
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated at trigger for domain_health
DROP TRIGGER IF EXISTS update_domain_health_updated_at ON domain_health;
CREATE TRIGGER update_domain_health_updated_at
  BEFORE UPDATE ON domain_health
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_account_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_health ENABLE ROW LEVEL SECURITY;

-- Admin full access to email_accounts
DROP POLICY IF EXISTS "Admin can manage email_accounts" ON email_accounts;
CREATE POLICY "Admin can manage email_accounts" ON email_accounts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Service role full access to email_accounts
DROP POLICY IF EXISTS "Service role can manage email_accounts" ON email_accounts;
CREATE POLICY "Service role can manage email_accounts" ON email_accounts
  FOR ALL TO service_role
  USING (true);

-- Admin full access to health history
DROP POLICY IF EXISTS "Admin can manage health_history" ON email_account_health_history;
CREATE POLICY "Admin can manage health_history" ON email_account_health_history
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Service role full access to health history
DROP POLICY IF EXISTS "Service role can manage health_history" ON email_account_health_history;
CREATE POLICY "Service role can manage health_history" ON email_account_health_history
  FOR ALL TO service_role
  USING (true);

-- Admin full access to domain health
DROP POLICY IF EXISTS "Admin can manage domain_health" ON domain_health;
CREATE POLICY "Admin can manage domain_health" ON domain_health
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Service role full access to domain health
DROP POLICY IF EXISTS "Service role can manage domain_health" ON domain_health;
CREATE POLICY "Service role can manage domain_health" ON domain_health
  FOR ALL TO service_role
  USING (true);

-- ============================================
-- 6. HELPFUL VIEWS
-- ============================================

-- View: Email accounts with client info and domain health
CREATE OR REPLACE VIEW email_accounts_with_health AS
SELECT
  ea.id,
  ea.provider_type,
  ea.provider_account_id,
  ea.email,
  ea.client_id,
  ea.first_name,
  ea.last_name,
  ea.domain,
  ea.status,
  ea.error_message,
  ea.warmup_enabled,
  ea.warmup_reputation,
  ea.warmup_emails_sent,
  ea.warmup_emails_received,
  ea.warmup_saved_from_spam,
  ea.daily_limit,
  ea.emails_sent_today,
  ea.last_synced_at,
  ea.created_at,
  ea.updated_at,
  c.name as client_name,
  dh.health_score as domain_health_score,
  dh.has_spf,
  dh.spf_valid,
  dh.has_dkim,
  dh.dkim_valid,
  dh.has_dmarc,
  dh.dmarc_valid,
  dh.dmarc_policy
FROM email_accounts ea
LEFT JOIN clients c ON c.id = ea.client_id
LEFT JOIN domain_health dh ON dh.domain = ea.domain;

-- View: Domain summary with account counts
CREATE OR REPLACE VIEW domain_summary AS
SELECT
  dh.id,
  dh.domain,
  dh.has_spf,
  dh.spf_valid,
  dh.spf_record,
  dh.has_dkim,
  dh.dkim_valid,
  dh.dkim_selector,
  dh.has_dmarc,
  dh.dmarc_valid,
  dh.dmarc_policy,
  dh.dmarc_record,
  dh.health_score,
  dh.last_checked_at,
  dh.created_at,
  dh.updated_at,
  COUNT(ea.id) as account_count,
  COUNT(DISTINCT ea.client_id) as client_count
FROM domain_health dh
LEFT JOIN email_accounts ea ON ea.domain = dh.domain
GROUP BY dh.id;

-- ============================================
-- 7. FUNCTION TO CALCULATE DOMAIN HEALTH SCORE
-- ============================================

CREATE OR REPLACE FUNCTION calculate_domain_health_score(
  p_spf_valid BOOLEAN,
  p_dkim_valid BOOLEAN,
  p_dmarc_valid BOOLEAN,
  p_dmarc_policy TEXT
) RETURNS INTEGER AS $$
BEGIN
  -- Calculate score based on DNS authentication status
  IF p_spf_valid AND p_dkim_valid AND p_dmarc_valid AND p_dmarc_policy IN ('quarantine', 'reject') THEN
    RETURN 100;
  ELSIF p_spf_valid AND p_dkim_valid AND p_dmarc_valid THEN
    RETURN 85;
  ELSIF p_spf_valid AND p_dkim_valid THEN
    RETURN 70;
  ELSIF p_spf_valid OR p_dkim_valid THEN
    RETURN 50;
  ELSE
    RETURN 25;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- DONE! Infrastructure health tables are ready.
-- ============================================
