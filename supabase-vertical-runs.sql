-- Vertical run tracking: records when a campaign was run for a specific vertical
CREATE TABLE IF NOT EXISTS vertical_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vertical text NOT NULL,
  date_started date NOT NULL,
  geography text,
  lead_count integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups by client + vertical
CREATE INDEX IF NOT EXISTS idx_vertical_runs_client_vertical ON vertical_runs(client_id, vertical);

-- RLS
ALTER TABLE vertical_runs ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to vertical_runs"
  ON vertical_runs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Client users can view vertical runs for their clients
CREATE POLICY "Client users can view vertical_runs"
  ON vertical_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = vertical_runs.client_id
        AND client_users.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS
