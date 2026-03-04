-- ============================================
-- MULTI-TENANCY ISOLATION - Migration
-- Adds owner_id to clients, is_platform_admin to profiles,
-- owner_id to settings, and updates RLS policies.
-- ============================================

-- Step 1: Add is_platform_admin to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Add owner_id to clients (nullable first for backfill)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Step 3: Add owner_id to settings (nullable, for per-owner settings)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Step 4: Backfill - assign all existing data to tilman
DO $$
DECLARE
  tilman_id UUID;
BEGIN
  -- Look up tilman's user ID from profiles
  SELECT id INTO tilman_id FROM profiles WHERE email = 'tilman@blue-reach.com' LIMIT 1;

  IF tilman_id IS NULL THEN
    -- Fallback: look up from auth.users
    SELECT id INTO tilman_id FROM auth.users WHERE email = 'tilman@blue-reach.com' LIMIT 1;
  END IF;

  IF tilman_id IS NOT NULL THEN
    -- Mark tilman as platform admin
    UPDATE profiles SET is_platform_admin = TRUE WHERE id = tilman_id;

    -- Assign all existing clients to tilman
    UPDATE clients SET owner_id = tilman_id WHERE owner_id IS NULL;

    -- Assign all existing settings to tilman
    UPDATE settings SET owner_id = tilman_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- Step 5: Make owner_id NOT NULL on clients (after backfill)
ALTER TABLE clients ALTER COLUMN owner_id SET NOT NULL;

-- Step 6: Update settings unique constraint
-- Drop old unique on key (if it exists) and add composite unique on (key, owner_id)
DO $$
BEGIN
  -- Try to drop existing unique constraint on key
  -- The constraint name may vary, so we look it up
  PERFORM 1 FROM information_schema.table_constraints
    WHERE table_name = 'settings'
      AND constraint_type = 'UNIQUE'
      AND constraint_name IN (
        SELECT constraint_name FROM information_schema.constraint_column_usage
        WHERE table_name = 'settings' AND column_name = 'key'
      );
  IF FOUND THEN
    EXECUTE (
      SELECT 'ALTER TABLE settings DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'settings'
        AND tc.constraint_type = 'UNIQUE'
        AND ccu.column_name = 'key'
      LIMIT 1
    );
  END IF;
END $$;

-- Add composite unique constraint
ALTER TABLE settings ADD CONSTRAINT settings_key_owner_id_unique UNIQUE (key, owner_id);

-- Step 7: Add index on clients.owner_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);

-- Step 8: Add index on settings.owner_id
CREATE INDEX IF NOT EXISTS idx_settings_owner_id ON settings(owner_id);

-- ============================================
-- RLS POLICY UPDATES
-- ============================================

-- Helper function to check if user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM profiles WHERE id = user_id),
    FALSE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get owner_id for a client
CREATE OR REPLACE FUNCTION get_client_owner(p_client_id UUID)
RETURNS UUID AS $$
  SELECT owner_id FROM clients WHERE id = p_client_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ---- CLIENTS RLS ----
-- Drop existing admin policies on clients and recreate with owner scoping
DO $$
BEGIN
  -- Drop policies if they exist (ignore errors)
  BEGIN DROP POLICY IF EXISTS "Admin can manage clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin full access to clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own clients" ON clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (clients.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (clients.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  );

-- ---- CAMPAIGNS RLS ----
-- Update admin policies to scope through client ownership
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin full access to campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own campaigns" ON campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (SELECT 1 FROM clients WHERE clients.id = campaigns.client_id AND clients.owner_id = auth.uid())
          OR profiles.is_platform_admin = TRUE
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (SELECT 1 FROM clients WHERE clients.id = campaigns.client_id AND clients.owner_id = auth.uid())
          OR profiles.is_platform_admin = TRUE
        )
    )
  );

-- ---- LEADS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin full access to leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own leads" ON leads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          leads.campaign_id IS NULL  -- orphaned leads visible to all admins
          OR EXISTS (
            SELECT 1 FROM campaigns c
            JOIN clients cl ON cl.id = c.client_id
            WHERE c.id = leads.campaign_id
              AND (cl.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
          )
          OR profiles.is_platform_admin = TRUE
        )
    )
  );

-- ---- CLIENT_USERS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage client_users" ON client_users; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage client_users" ON client_users; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own client_users" ON client_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (SELECT 1 FROM clients WHERE clients.id = client_users.client_id AND clients.owner_id = auth.uid())
          OR profiles.is_platform_admin = TRUE
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (SELECT 1 FROM clients WHERE clients.id = client_users.client_id AND clients.owner_id = auth.uid())
          OR profiles.is_platform_admin = TRUE
        )
    )
  );

-- ---- CLIENT_INVITATIONS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage client_invitations" ON client_invitations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage client_invitations" ON client_invitations; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own client_invitations" ON client_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (SELECT 1 FROM clients WHERE clients.id = client_invitations.client_id AND clients.owner_id = auth.uid())
          OR profiles.is_platform_admin = TRUE
        )
    )
  );

-- ---- ACTIVITIES RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage activities" ON activities; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage activities" ON activities; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own activities" ON activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (
            SELECT 1 FROM leads l
            JOIN campaigns c ON c.id = l.campaign_id
            JOIN clients cl ON cl.id = c.client_id
            WHERE l.id = activities.lead_id
              AND (cl.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
          )
          OR profiles.is_platform_admin = TRUE
        )
    )
  );

-- ---- EMAIL_EVENTS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage email_events" ON email_events; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage email_events" ON email_events; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own email_events" ON email_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (
          EXISTS (
            SELECT 1 FROM campaigns c
            JOIN clients cl ON cl.id = c.client_id
            WHERE c.id = email_events.campaign_id
              AND (cl.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
          )
          OR profiles.is_platform_admin = TRUE
        )
    )
  );

-- ---- SETTINGS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage all settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own settings" ON settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (settings.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND (settings.owner_id = auth.uid() OR profiles.is_platform_admin = TRUE)
    )
  );
