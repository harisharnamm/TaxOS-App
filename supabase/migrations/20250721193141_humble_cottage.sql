/*
  # Enhance Document Client Association

  1. Database Changes
    - Ensure client_id foreign key constraint exists
    - Add index for better query performance on client_id
    - Add cascade delete for client documents

  2. Security
    - Update RLS policies to handle client-specific document access
    - Ensure users can only access documents for their clients

  3. Performance
    - Add composite index for user_id + client_id queries
    - Add index for document type filtering
*/

-- Ensure the foreign key constraint exists with proper cascade
DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'documents_client_id_fkey' 
    AND table_name = 'documents'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE documents 
    ADD CONSTRAINT documents_client_id_fkey 
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add composite index for efficient client document queries
CREATE INDEX IF NOT EXISTS idx_documents_user_client 
ON documents(user_id, client_id) 
WHERE client_id IS NOT NULL;

-- Add index for document type filtering
CREATE INDEX IF NOT EXISTS idx_documents_type_user 
ON documents(document_type, user_id);

-- Add index for processing status
CREATE INDEX IF NOT EXISTS idx_documents_processing_status 
ON documents(processing_status) 
WHERE processing_status IS NOT NULL;

-- Update RLS policy to ensure proper client document access
DROP POLICY IF EXISTS "Users can manage own documents" ON documents;

CREATE POLICY "Users can manage own documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND (
      client_id IS NULL OR 
      client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND (
      client_id IS NULL OR 
      client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  );

-- Add function to get client document count
CREATE OR REPLACE FUNCTION get_client_document_count(client_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM documents
  WHERE client_id = client_uuid
    AND user_id = auth.uid();
$$;

-- Add function to get user document statistics
CREATE OR REPLACE FUNCTION get_user_document_stats(user_uuid uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_documents', COUNT(*),
    'documents_with_clients', COUNT(*) FILTER (WHERE client_id IS NOT NULL),
    'documents_without_clients', COUNT(*) FILTER (WHERE client_id IS NULL),
    'processed_documents', COUNT(*) FILTER (WHERE processing_status = 'completed'),
    'pending_documents', COUNT(*) FILTER (WHERE processing_status IN ('pending', 'processing', 'classified'))
  )
  FROM documents
  WHERE user_id = user_uuid;
$$;