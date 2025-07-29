/*
  # Add Document Requests and Email Communications

  This migration adds tables for:
  1. document_requests - Track document requests sent to clients
  2. document_request_items - Individual documents within each request
  3. email_communications - Track email sending and engagement

  Features:
  - Secure upload tokens for client access
  - Email tracking with Resend integration
  - Proper RLS policies for data security
*/

-- Document Requests Table
CREATE TABLE document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  document_types text[] NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'complete', 'overdue')),
  due_date timestamptz NOT NULL,
  upload_token text UNIQUE NOT NULL,
  email_sent boolean DEFAULT false,
  last_reminder_sent timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Document Request Items Table
CREATE TABLE document_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded')),
  uploaded_document_id uuid REFERENCES documents(id),
  uploaded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Email Communications Table
CREATE TABLE email_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  request_id uuid REFERENCES document_requests(id),
  resend_message_id text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN ('initial_request', 'reminder', 'follow_up')),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_document_requests_user_id ON document_requests(user_id);
CREATE INDEX idx_document_requests_client_id ON document_requests(client_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);
CREATE INDEX idx_document_requests_upload_token ON document_requests(upload_token);
CREATE INDEX idx_document_requests_due_date ON document_requests(due_date);

CREATE INDEX idx_document_request_items_request_id ON document_request_items(request_id);
CREATE INDEX idx_document_request_items_status ON document_request_items(status);

CREATE INDEX idx_email_communications_user_id ON email_communications(user_id);
CREATE INDEX idx_email_communications_client_id ON email_communications(client_id);
CREATE INDEX idx_email_communications_request_id ON email_communications(request_id);
CREATE INDEX idx_email_communications_resend_message_id ON email_communications(resend_message_id);
CREATE INDEX idx_email_communications_status ON email_communications(status);

-- Enable RLS
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_requests
CREATE POLICY "Users can manage own document requests"
  ON document_requests
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for document_request_items
CREATE POLICY "Users can manage own document request items"
  ON document_request_items
  FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM document_requests WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    request_id IN (
      SELECT id FROM document_requests WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for email_communications
CREATE POLICY "Users can manage own email communications"
  ON email_communications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to generate upload tokens
CREATE OR REPLACE FUNCTION generate_upload_token()
RETURNS text AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_document_requests_updated_at
  BEFORE UPDATE ON document_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_document_requests_updated_at(); 