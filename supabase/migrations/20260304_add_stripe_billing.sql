-- ============================================
-- STRIPE BILLING - Migration
-- ============================================

-- Add stripe_customer_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Create subscription plan enum
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('starter', 'growth', 'agency');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create subscription status enum (matches Stripe statuses)
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create stripe_subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  client_limit INTEGER, -- 3 for starter, 10 for growth, NULL for unlimited (agency)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_sub_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);

-- Enable RLS
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON stripe_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Only service role can insert/update (webhooks)
-- No INSERT/UPDATE policies for anon/authenticated = service role only
