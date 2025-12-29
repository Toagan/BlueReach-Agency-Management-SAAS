-- ============================================
-- SETTINGS TABLE
-- ============================================
-- Run this in Supabase SQL Editor
-- Stores app settings like API keys
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  is_encrypted boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage settings
CREATE POLICY "Admins can manage settings" ON settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Insert default settings (empty values)
INSERT INTO settings (key, value, is_encrypted) VALUES
  ('instantly_api_key', '', true),
  ('instantly_webhook_secret', '', true)
ON CONFLICT (key) DO NOTHING;

-- Function to update setting
CREATE OR REPLACE FUNCTION update_setting(p_key text, p_value text, p_user_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE settings
  SET value = p_value,
      updated_at = now(),
      updated_by = p_user_id
  WHERE key = p_key;

  IF NOT FOUND THEN
    INSERT INTO settings (key, value, updated_by)
    VALUES (p_key, p_value, p_user_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get setting
CREATE OR REPLACE FUNCTION get_setting(p_key text)
RETURNS text AS $$
DECLARE
  v_value text;
BEGIN
  SELECT value INTO v_value FROM settings WHERE key = p_key;
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
