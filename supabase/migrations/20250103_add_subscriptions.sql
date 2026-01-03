-- ============================================
-- SUBSCRIPTIONS TABLE - Agency SaaS Expense Tracking
-- ============================================

-- Billing cycle enum
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly', 'quarterly', 'weekly', 'custom');

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  username TEXT,
  password TEXT,
  cost DECIMAL(10, 2) DEFAULT 0,
  billing_cycle billing_cycle DEFAULT 'monthly',
  renewal_date DATE,
  credits_balance INTEGER DEFAULT 0,
  credits_limit INTEGER DEFAULT 0,
  category TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX idx_subscriptions_renewal_date ON subscriptions(renewal_date);
CREATE INDEX idx_subscriptions_category ON subscriptions(category);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- RLS Policies (admin only)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Only admins can view subscriptions
CREATE POLICY "Admins can view subscriptions"
  ON subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can insert subscriptions
CREATE POLICY "Admins can insert subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update subscriptions
CREATE POLICY "Admins can update subscriptions"
  ON subscriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can delete subscriptions
CREATE POLICY "Admins can delete subscriptions"
  ON subscriptions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
