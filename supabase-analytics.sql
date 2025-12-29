-- ============================================
-- ANALYTICS STORAGE TABLE
-- Store Instantly analytics in Supabase
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create analytics_snapshots table to store daily analytics
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  instantly_campaign_id text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Lead counts
  leads_count integer DEFAULT 0,
  contacted_count integer DEFAULT 0,
  completed_count integer DEFAULT 0,
  new_leads_contacted_count integer DEFAULT 0,

  -- Email metrics
  emails_sent_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  open_count_unique integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  reply_count_unique integer DEFAULT 0,
  link_click_count integer DEFAULT 0,
  link_click_count_unique integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  unsubscribed_count integer DEFAULT 0,

  -- Opportunities
  total_opportunities integer DEFAULT 0,
  total_opportunity_value decimal(12,2) DEFAULT 0,
  total_interested integer DEFAULT 0,
  total_meeting_booked integer DEFAULT 0,
  total_meeting_completed integer DEFAULT 0,
  total_closed integer DEFAULT 0,

  -- Metadata
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now(),

  -- Unique constraint: one snapshot per campaign per day
  CONSTRAINT unique_campaign_date UNIQUE (instantly_campaign_id, snapshot_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_campaign ON analytics_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_instantly_id ON analytics_snapshots(instantly_campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(snapshot_date);

-- Create a view for the latest analytics per campaign
CREATE OR REPLACE VIEW latest_campaign_analytics AS
SELECT DISTINCT ON (instantly_campaign_id)
  id,
  campaign_id,
  instantly_campaign_id,
  snapshot_date,
  leads_count,
  contacted_count,
  emails_sent_count,
  open_count,
  open_count_unique,
  reply_count,
  reply_count_unique,
  link_click_count,
  link_click_count_unique,
  bounced_count,
  unsubscribed_count,
  total_opportunities,
  total_opportunity_value,
  -- Calculate rates
  CASE WHEN emails_sent_count > 0
    THEN ROUND((open_count_unique::decimal / emails_sent_count * 100), 2)
    ELSE 0
  END as open_rate,
  CASE WHEN emails_sent_count > 0
    THEN ROUND((link_click_count_unique::decimal / emails_sent_count * 100), 2)
    ELSE 0
  END as click_rate,
  CASE WHEN emails_sent_count > 0
    THEN ROUND((reply_count_unique::decimal / emails_sent_count * 100), 2)
    ELSE 0
  END as reply_rate,
  created_at
FROM analytics_snapshots
ORDER BY instantly_campaign_id, snapshot_date DESC;

-- Create aggregated overview view
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  COUNT(DISTINCT instantly_campaign_id) as total_campaigns,
  SUM(leads_count) as total_leads,
  SUM(emails_sent_count) as total_emails_sent,
  SUM(open_count_unique) as total_opened,
  SUM(link_click_count_unique) as total_clicked,
  SUM(reply_count_unique) as total_replies,
  SUM(bounced_count) as total_bounced,
  SUM(total_opportunities) as total_opportunities,
  SUM(total_opportunity_value) as total_opportunity_value,
  CASE WHEN SUM(emails_sent_count) > 0
    THEN ROUND((SUM(open_count_unique)::decimal / SUM(emails_sent_count) * 100), 2)
    ELSE 0
  END as overall_open_rate,
  CASE WHEN SUM(emails_sent_count) > 0
    THEN ROUND((SUM(link_click_count_unique)::decimal / SUM(emails_sent_count) * 100), 2)
    ELSE 0
  END as overall_click_rate,
  CASE WHEN SUM(emails_sent_count) > 0
    THEN ROUND((SUM(reply_count_unique)::decimal / SUM(emails_sent_count) * 100), 2)
    ELSE 0
  END as overall_reply_rate,
  MAX(snapshot_date) as last_updated
FROM latest_campaign_analytics;

-- Enable RLS
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage analytics_snapshots"
  ON analytics_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to upsert analytics snapshot
CREATE OR REPLACE FUNCTION upsert_analytics_snapshot(
  p_instantly_campaign_id text,
  p_campaign_id uuid,
  p_data jsonb
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO analytics_snapshots (
    campaign_id,
    instantly_campaign_id,
    snapshot_date,
    leads_count,
    contacted_count,
    completed_count,
    new_leads_contacted_count,
    emails_sent_count,
    open_count,
    open_count_unique,
    reply_count,
    reply_count_unique,
    link_click_count,
    link_click_count_unique,
    bounced_count,
    unsubscribed_count,
    total_opportunities,
    total_opportunity_value,
    total_interested,
    total_meeting_booked,
    total_meeting_completed,
    total_closed,
    raw_data
  ) VALUES (
    p_campaign_id,
    p_instantly_campaign_id,
    CURRENT_DATE,
    COALESCE((p_data->>'leads_count')::integer, 0),
    COALESCE((p_data->>'contacted_count')::integer, 0),
    COALESCE((p_data->>'completed_count')::integer, 0),
    COALESCE((p_data->>'new_leads_contacted_count')::integer, 0),
    COALESCE((p_data->>'emails_sent_count')::integer, 0),
    COALESCE((p_data->>'open_count')::integer, 0),
    COALESCE((p_data->>'open_count_unique')::integer, 0),
    COALESCE((p_data->>'reply_count')::integer, 0),
    COALESCE((p_data->>'reply_count_unique')::integer, 0),
    COALESCE((p_data->>'link_click_count')::integer, 0),
    COALESCE((p_data->>'link_click_count_unique')::integer, 0),
    COALESCE((p_data->>'bounced_count')::integer, 0),
    COALESCE((p_data->>'unsubscribed_count')::integer, 0),
    COALESCE((p_data->>'total_opportunities')::integer, 0),
    COALESCE((p_data->>'total_opportunity_value')::decimal, 0),
    COALESCE((p_data->>'total_interested')::integer, 0),
    COALESCE((p_data->>'total_meeting_booked')::integer, 0),
    COALESCE((p_data->>'total_meeting_completed')::integer, 0),
    COALESCE((p_data->>'total_closed')::integer, 0),
    p_data
  )
  ON CONFLICT (instantly_campaign_id, snapshot_date)
  DO UPDATE SET
    leads_count = EXCLUDED.leads_count,
    contacted_count = EXCLUDED.contacted_count,
    completed_count = EXCLUDED.completed_count,
    new_leads_contacted_count = EXCLUDED.new_leads_contacted_count,
    emails_sent_count = EXCLUDED.emails_sent_count,
    open_count = EXCLUDED.open_count,
    open_count_unique = EXCLUDED.open_count_unique,
    reply_count = EXCLUDED.reply_count,
    reply_count_unique = EXCLUDED.reply_count_unique,
    link_click_count = EXCLUDED.link_click_count,
    link_click_count_unique = EXCLUDED.link_click_count_unique,
    bounced_count = EXCLUDED.bounced_count,
    unsubscribed_count = EXCLUDED.unsubscribed_count,
    total_opportunities = EXCLUDED.total_opportunities,
    total_opportunity_value = EXCLUDED.total_opportunity_value,
    total_interested = EXCLUDED.total_interested,
    total_meeting_booked = EXCLUDED.total_meeting_booked,
    total_meeting_completed = EXCLUDED.total_meeting_completed,
    total_closed = EXCLUDED.total_closed,
    raw_data = EXCLUDED.raw_data
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
