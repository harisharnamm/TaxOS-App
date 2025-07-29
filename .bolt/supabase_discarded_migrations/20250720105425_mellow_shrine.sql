/*
  # Add Client Notes Feature

  1. New Tables
    - `client_notes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `client_id` (uuid, foreign key to clients)
      - `title` (text, note title)
      - `content` (text, note content)
      - `category` (text, note category)
      - `priority` (text, note priority)
      - `tags` (text[], note tags)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `client_notes` table
    - Add policy for users to manage their own client notes

  3. Indexes
    - Add indexes for efficient querying by client_id, user_id, category, and priority
*/

CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'medium',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints for category and priority
ALTER TABLE client_notes ADD CONSTRAINT client_notes_category_check 
  CHECK (category IN ('general', 'tax_planning', 'compliance', 'communication', 'meeting', 'document'));

ALTER TABLE client_notes ADD CONSTRAINT client_notes_priority_check 
  CHECK (priority IN ('low', 'medium', 'high'));

-- Enable RLS
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage own client notes"
  ON client_notes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_notes_user_id ON client_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_category ON client_notes(category);
CREATE INDEX IF NOT EXISTS idx_client_notes_priority ON client_notes(priority);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON client_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notes_tags ON client_notes USING gin(tags);

-- Add updated_at trigger
CREATE TRIGGER update_client_notes_updated_at
  BEFORE UPDATE ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();