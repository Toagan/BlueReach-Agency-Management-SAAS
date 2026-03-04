-- ============================================
-- FIX: Infinite recursion in RLS policies
-- The old policies had circular references:
--   client_users policy → SELECT FROM clients → clients policy → SELECT FROM profiles → profiles policy → SELECT FROM client_users → LOOP
-- Fix: Use SECURITY DEFINER helper functions that bypass RLS instead of direct table queries.
-- ============================================

-- Ensure helper functions exist (SECURITY DEFINER = bypasses RLS)
CREATE OR REPLACE FUNCTION is_platform_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM profiles WHERE id = user_id),
    FALSE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_client_owner(p_client_id UUID)
RETURNS UUID AS $$
  SELECT owner_id FROM clients WHERE id = p_client_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: check if user is admin role (bypasses profiles RLS)
CREATE OR REPLACE FUNCTION is_admin_role(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM profiles WHERE id = user_id),
    FALSE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ---- CLIENTS RLS ----
-- Fix: Don't reference profiles table directly. Use SECURITY DEFINER functions.
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin full access to clients" ON clients; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own clients" ON clients
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (clients.owner_id = auth.uid() OR is_platform_admin(auth.uid()))
  )
  WITH CHECK (
    is_admin_role(auth.uid())
    AND (clients.owner_id = auth.uid() OR is_platform_admin(auth.uid()))
  );

-- ---- CAMPAIGNS RLS ----
-- Fix: Use get_client_owner() instead of SELECT FROM clients
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin full access to campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own campaigns" ON campaigns
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (
      get_client_owner(campaigns.client_id) = auth.uid()
      OR is_platform_admin(auth.uid())
    )
  )
  WITH CHECK (
    is_admin_role(auth.uid())
    AND (
      get_client_owner(campaigns.client_id) = auth.uid()
      OR is_platform_admin(auth.uid())
    )
  );

-- ---- LEADS RLS ----
-- Fix: Use get_client_owner() via campaign lookup instead of joining clients
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin full access to leads" ON leads; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Helper: get owner_id from a campaign_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_campaign_owner(p_campaign_id UUID)
RETURNS UUID AS $$
  SELECT get_client_owner(client_id) FROM campaigns WHERE id = p_campaign_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE POLICY "Admin can manage own leads" ON leads
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (
      leads.campaign_id IS NULL
      OR get_campaign_owner(leads.campaign_id) = auth.uid()
      OR is_platform_admin(auth.uid())
    )
  );

-- ---- CLIENT_USERS RLS ----
-- Fix: Use get_client_owner() instead of SELECT FROM clients
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own client_users" ON client_users; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage client_users" ON client_users; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage client_users" ON client_users; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Keep existing policy for client users to see their own links
-- Only fix the admin policy
CREATE POLICY "Admin can manage own client_users" ON client_users
  FOR ALL
  TO authenticated
  USING (
    -- Users can always see their own links
    client_users.user_id = auth.uid()
    OR (
      is_admin_role(auth.uid())
      AND (
        get_client_owner(client_users.client_id) = auth.uid()
        OR is_platform_admin(auth.uid())
      )
    )
  )
  WITH CHECK (
    is_admin_role(auth.uid())
    AND (
      get_client_owner(client_users.client_id) = auth.uid()
      OR is_platform_admin(auth.uid())
    )
  );

-- ---- CLIENT_INVITATIONS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own client_invitations" ON client_invitations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage client_invitations" ON client_invitations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage client_invitations" ON client_invitations; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own client_invitations" ON client_invitations
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (
      get_client_owner(client_invitations.client_id) = auth.uid()
      OR is_platform_admin(auth.uid())
    )
  );

-- ---- ACTIVITIES RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own activities" ON activities; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage activities" ON activities; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage activities" ON activities; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own activities" ON activities
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (
      is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = activities.lead_id
          AND get_campaign_owner(l.campaign_id) = auth.uid()
      )
    )
  );

-- ---- EMAIL_EVENTS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own email_events" ON email_events; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage email_events" ON email_events; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage email_events" ON email_events; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own email_events" ON email_events
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (
      get_campaign_owner(email_events.campaign_id) = auth.uid()
      OR is_platform_admin(auth.uid())
    )
  );

-- ---- SETTINGS RLS ----
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Admin can manage own settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins can manage settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admin can manage all settings" ON settings; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Admin can manage own settings" ON settings
  FOR ALL
  TO authenticated
  USING (
    is_admin_role(auth.uid())
    AND (settings.owner_id = auth.uid() OR is_platform_admin(auth.uid()))
  )
  WITH CHECK (
    is_admin_role(auth.uid())
    AND (settings.owner_id = auth.uid() OR is_platform_admin(auth.uid()))
  );
