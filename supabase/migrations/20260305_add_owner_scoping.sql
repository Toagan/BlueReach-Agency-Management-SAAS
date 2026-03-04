-- ============================================
-- OWNER SCOPING - Add owner_id to subscriptions, lead_sources, email_accounts
-- ============================================

-- Step 1: Add owner_id columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE lead_sources ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Step 2: Backfill all to tilman
DO $$
DECLARE
  tilman_id UUID;
BEGIN
  SELECT id INTO tilman_id FROM profiles WHERE email = 'tilman@blue-reach.com' LIMIT 1;

  IF tilman_id IS NULL THEN
    SELECT id INTO tilman_id FROM auth.users WHERE email = 'tilman@blue-reach.com' LIMIT 1;
  END IF;

  IF tilman_id IS NOT NULL THEN
    UPDATE subscriptions SET owner_id = tilman_id WHERE owner_id IS NULL;
    UPDATE lead_sources SET owner_id = tilman_id WHERE owner_id IS NULL;
    UPDATE email_accounts SET owner_id = tilman_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- Step 3: Make owner_id NOT NULL (after backfill)
ALTER TABLE subscriptions ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE lead_sources ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE email_accounts ALTER COLUMN owner_id SET NOT NULL;

-- Step 4: Add indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_id ON subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_owner_id ON lead_sources(owner_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_owner_id ON email_accounts(owner_id);

-- Step 5: RLS policies for subscriptions
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage subscriptions" ON subscriptions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage subscriptions" ON subscriptions; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own subscriptions" ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (subscriptions.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (subscriptions.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  );

-- Step 6: RLS policies for lead_sources
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage lead_sources" ON lead_sources; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage lead_sources" ON lead_sources; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own lead_sources" ON lead_sources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (lead_sources.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (lead_sources.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  );

-- Step 7: RLS policies for email_accounts
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage email_accounts" ON email_accounts; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage email_accounts" ON email_accounts; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own email_accounts" ON email_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (email_accounts.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (email_accounts.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  );
