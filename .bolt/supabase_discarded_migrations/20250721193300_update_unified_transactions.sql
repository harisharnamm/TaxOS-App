/*
  # Update Unified Transactions Table

  1. Database Changes
    - Add user_id column to unified_transactions table
    - Enable RLS on unified_transactions table
    - Add RLS policies for authenticated users
    - Update document_source check constraint to include 'manual'

  2. Security
    - Enable RLS on unified_transactions table
    - Add policies for authenticated users to manage their own transactions

  3. Data Migration
    - Set user_id for existing transactions based on client ownership
*/

-- Add user_id column to unified_transactions table
ALTER TABLE unified_transactions 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing transactions to set user_id based on client ownership
UPDATE unified_transactions 
SET user_id = clients.user_id
FROM clients 
WHERE unified_transactions.client_id = clients.id 
  AND unified_transactions.user_id IS NULL;

-- Make user_id NOT NULL after setting values
ALTER TABLE unified_transactions 
ALTER COLUMN user_id SET NOT NULL;

-- Update document_source check constraint to include 'manual'
ALTER TABLE unified_transactions 
DROP CONSTRAINT IF EXISTS unified_transactions_document_source_check;

ALTER TABLE unified_transactions 
ADD CONSTRAINT unified_transactions_document_source_check 
CHECK (document_source IN ('manual', 'bank_statement', 'invoice', 'receipt', 'other'));

-- Enable RLS on unified_transactions table
ALTER TABLE unified_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for unified_transactions
CREATE POLICY "Users can manage own transactions"
  ON unified_transactions
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_unified_transactions_user_id ON unified_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_transactions_user_client ON unified_transactions(user_id, client_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_unified_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_unified_transactions_updated_at ON unified_transactions;
CREATE TRIGGER update_unified_transactions_updated_at
  BEFORE UPDATE ON unified_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_transactions_updated_at(); 