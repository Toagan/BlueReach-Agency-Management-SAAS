-- ============================================
-- BLUEREACH AGENCY PORTAL - SCHEMA V2
-- ============================================
-- Run this in Supabase SQL Editor
-- This adds new tables and columns to existing schema
-- ============================================

-- ============================================
-- 1. MODIFY LEADS TABLE - Add new columns
-- ============================================

-- Add new columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS is_positive_reply boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deal_value numeric,
ADD COLUMN IF NOT EXISTS next_action text,
ADD COLUMN IF NOT EXISTS next_action_date date,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Update status check constraint to include more statuses
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('contacted', 'opened', 'clicked', 'replied', 'booked', 'won', 'lost', 'not_interested'));

-- Index for positive replies (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_leads_positive_reply ON leads(is_positive_reply) WHERE is_positive_reply = true;

-- Index for next action date (for follow-up reminders)
CREATE INDEX IF NOT EXISTS idx_leads_next_action_date ON leads(next_action_date) WHERE next_action_date IS NOT NULL;


-- ============================================
-- 2. CREATE ACTIVITIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Activity details
  type text NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'note', 'status_change', 'task', 'other')),
  title text,
  description text,

  -- Scheduling
  scheduled_at timestamptz,
  completed_at timestamptz,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled ON activities(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- RLS for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all activities" ON activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can view activities for leads they have access to
CREATE POLICY "Users can view activities for accessible leads" ON activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN client_users cu ON c.client_id = cu.client_id
      WHERE l.id = activities.lead_id AND cu.user_id = auth.uid()
    )
  );

-- Users can create activities for leads they have access to
CREATE POLICY "Users can create activities for accessible leads" ON activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN client_users cu ON c.client_id = cu.client_id
      WHERE l.id = activities.lead_id AND cu.user_id = auth.uid()
    )
  );


-- ============================================
-- 3. CREATE EMAIL_EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Event details
  event_type text NOT NULL CHECK (event_type IN ('sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'spam_complaint')),

  -- From Instantly
  instantly_event_id text,
  email_subject text,
  link_clicked text,  -- URL if event_type = 'clicked'

  -- Timing
  timestamp timestamptz DEFAULT now(),

  -- Extra data from webhook
  metadata jsonb DEFAULT '{}'
);

-- Indexes for email_events
CREATE INDEX IF NOT EXISTS idx_email_events_lead ON email_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp DESC);

-- Unique constraint to prevent duplicate events
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_unique
  ON email_events(lead_id, event_type, timestamp)
  WHERE instantly_event_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_instantly_unique
  ON email_events(instantly_event_id)
  WHERE instantly_event_id IS NOT NULL;

-- RLS for email_events
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all email_events" ON email_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can view email_events for their campaigns
CREATE POLICY "Users can view email_events for accessible campaigns" ON email_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN client_users cu ON c.client_id = cu.client_id
      WHERE c.id = email_events.campaign_id AND cu.user_id = auth.uid()
    )
  );

-- Service role can insert (for webhooks)
CREATE POLICY "Service role can insert email_events" ON email_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ============================================
-- 4. CREATE TEAM_MEMBERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Role within this client
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'member', 'viewer')),

  -- Invitation tracking
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,

  -- Unique constraint: one role per user per client
  UNIQUE(client_id, user_id)
);

-- Indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_client ON team_members(client_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- RLS for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all team_members" ON team_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can view their own team memberships
CREATE POLICY "Users can view own team memberships" ON team_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owners and managers can view team members for their clients
CREATE POLICY "Owners can view team for their clients" ON team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.client_id = team_members.client_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'manager')
    )
  );

-- Owners can manage team members
CREATE POLICY "Owners can manage team for their clients" ON team_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.client_id = team_members.client_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );


-- ============================================
-- 5. CREATE AUDIT_LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who made the change
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_email text,  -- Denormalized for when user is deleted

  -- What was changed
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  table_name text NOT NULL,
  record_id uuid NOT NULL,

  -- The actual changes
  old_data jsonb,  -- Previous values (for update/delete)
  new_data jsonb,  -- New values (for create/update)
  changed_fields text[],  -- List of fields that changed

  -- Context
  ip_address inet,
  user_agent text,

  -- Timestamp
  created_at timestamptz DEFAULT now()
);

-- Indexes for audit_logs (optimized for common queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit_logs" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert (for automatic logging)
CREATE POLICY "Service role can insert audit_logs" ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Prevent updates and deletes on audit logs (immutable)
-- No UPDATE or DELETE policies = cannot modify audit logs


-- ============================================
-- 6. HELPER FUNCTION: Log audit entry
-- ============================================

CREATE OR REPLACE FUNCTION log_audit(
  p_user_id uuid,
  p_action text,
  p_table_name text,
  p_record_id uuid,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_user_email text;
  v_changed_fields text[];
  v_audit_id uuid;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM profiles WHERE id = p_user_id;

  -- Calculate changed fields for updates
  IF p_action = 'update' AND p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
    SELECT array_agg(key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(p_new_data)
      EXCEPT
      SELECT key FROM jsonb_each(p_old_data) WHERE p_old_data->key = p_new_data->key
    ) changed;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (user_id, user_email, action, table_name, record_id, old_data, new_data, changed_fields)
  VALUES (p_user_id, v_user_email, p_action, p_table_name, p_record_id, p_old_data, p_new_data, v_changed_fields)
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 7. UPDATE CLIENT_USERS TABLE (if exists)
-- ============================================

-- Add role column to existing client_users if it doesn't have one
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_users') THEN
    ALTER TABLE client_users ADD COLUMN IF NOT EXISTS role text DEFAULT 'viewer';
  END IF;
END $$;


-- ============================================
-- 8. CREATE VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Positive replies with lead details
CREATE OR REPLACE VIEW positive_replies AS
SELECT
  l.*,
  c.name as campaign_name,
  cl.name as client_name,
  (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id) as activity_count,
  (SELECT MAX(created_at) FROM activities a WHERE a.lead_id = l.id) as last_activity_at
FROM leads l
JOIN campaigns c ON l.campaign_id = c.id
JOIN clients cl ON c.client_id = cl.id
WHERE l.is_positive_reply = true
ORDER BY l.updated_at DESC;

-- View: Campaign performance summary
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  cl.name as client_name,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'opened') as opened_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'clicked') as clicked_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'replied') as replied_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.is_positive_reply = true) as positive_reply_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'booked') as booked_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') as won_count,
  COALESCE(SUM(l.deal_value) FILTER (WHERE l.status = 'won'), 0) as total_deal_value
FROM campaigns c
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN leads l ON l.campaign_id = c.id
GROUP BY c.id, c.name, cl.name;


-- ============================================
-- DONE! Schema V2 is ready.
-- ============================================

-- Summary of changes:
-- 1. leads: Added last_name, company_name, phone, linkedin_url,
--           is_positive_reply, deal_value, next_action, next_action_date,
--           metadata, created_at
-- 2. activities: NEW - Track calls, meetings, notes per lead
-- 3. email_events: NEW - Store Instantly webhook events
-- 4. team_members: NEW - Multi-user access with roles
-- 5. audit_logs: NEW - Track who changed what
-- 6. Views: positive_replies, campaign_performance
