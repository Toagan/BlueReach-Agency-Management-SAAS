-- ============================================
-- Copy Review Feature
-- Allows agency clients and admins to approve/reject
-- email copy variants and leave inline comments
-- ============================================

-- Per-variant approval status
CREATE TABLE IF NOT EXISTS copy_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  variant text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comment text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewer_name text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, step_number, variant)
);

-- Inline text-selection comments (Google Docs style)
CREATE TABLE IF NOT EXISTS copy_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  variant text NOT NULL,
  selected_text text NOT NULL,
  start_offset integer NOT NULL,
  end_offset integer NOT NULL,
  comment text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_name text,
  resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE copy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for copy_reviews
CREATE POLICY "Admin can manage copy reviews" ON copy_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Client can manage copy reviews for their campaigns" ON copy_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN client_users cu ON cu.client_id = c.client_id
      WHERE c.id = copy_reviews.campaign_id
      AND cu.user_id = auth.uid()
    )
  );

-- RLS policies for copy_comments
CREATE POLICY "Admin can manage copy comments" ON copy_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Client can manage copy comments for their campaigns" ON copy_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN client_users cu ON cu.client_id = c.client_id
      WHERE c.id = copy_comments.campaign_id
      AND cu.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_copy_reviews_campaign ON copy_reviews(campaign_id);
CREATE INDEX idx_copy_comments_campaign ON copy_comments(campaign_id);
CREATE INDEX idx_copy_comments_variant ON copy_comments(campaign_id, step_number, variant);
