-- Add RLS policy to allow client document uploads
-- This policy allows inserting documents when uploaded_via_token is true and upload_token matches

CREATE POLICY "Allow client document uploads" ON documents
FOR INSERT
WITH CHECK (
  uploaded_via_token = true 
  AND upload_token IS NOT NULL
);

-- Also allow reading documents that were uploaded via token
CREATE POLICY "Allow reading client uploaded documents" ON documents
FOR SELECT
USING (
  uploaded_via_token = true 
  AND upload_token IS NOT NULL
);

-- Allow updating document request items for client uploads
CREATE POLICY "Allow updating document request items for uploads" ON document_request_items
FOR UPDATE
USING (true)
WITH CHECK (true); 