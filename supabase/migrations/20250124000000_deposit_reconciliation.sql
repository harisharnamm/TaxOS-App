-- Migration: Deposit Reconciliation System
-- Description: Creates tables for automated deposit reconciliation with AI matching

-- 1. Reconciliation Matches Table
CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  ar_item_id UUID, -- Will reference AR table when implemented
  match_confidence DECIMAL(3,2) NOT NULL CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_reasoning TEXT,
  match_type TEXT NOT NULL CHECK (match_type IN ('auto', 'manual', 'ai_suggested')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'modified')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  modified_fields JSONB -- Store what was modified by user
);

-- 2. AR Candidates Table (Accounts Receivable items that need matching)
CREATE TABLE IF NOT EXISTS ar_candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number TEXT,
  customer_name TEXT,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'overdue', 'cancelled')),
  description TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Reconciliation Rules Table (AI learning patterns)
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('payee_pattern', 'amount_pattern', 'date_pattern', 'category_pattern')),
  pattern TEXT NOT NULL,
  confidence_boost DECIMAL(3,2) DEFAULT 0.1,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Reconciliation History Table (Audit trail)
CREATE TABLE IF NOT EXISTS reconciliation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES reconciliation_matches(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'accepted', 'rejected', 'modified')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_state JSONB,
  new_state JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_transaction ON reconciliation_matches(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_client ON reconciliation_matches(client_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_status ON reconciliation_matches(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_confidence ON reconciliation_matches(match_confidence);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_created ON reconciliation_matches(created_at);

CREATE INDEX IF NOT EXISTS idx_ar_candidates_client ON ar_candidates(client_id);
CREATE INDEX IF NOT EXISTS idx_ar_candidates_status ON ar_candidates(status);
CREATE INDEX IF NOT EXISTS idx_ar_candidates_amount ON ar_candidates(amount);
CREATE INDEX IF NOT EXISTS idx_ar_candidates_due_date ON ar_candidates(due_date);

CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_client ON reconciliation_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_type ON reconciliation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_active ON reconciliation_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_reconciliation_history_match ON reconciliation_history(match_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_history_action ON reconciliation_history(action);
CREATE INDEX IF NOT EXISTS idx_reconciliation_history_created ON reconciliation_history(created_at);

-- Enable Row Level Security
ALTER TABLE reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reconciliation_matches
CREATE POLICY "Users can view reconciliation matches for their clients" ON reconciliation_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = reconciliation_matches.client_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reconciliation matches for their clients" ON reconciliation_matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = reconciliation_matches.client_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reconciliation matches for their clients" ON reconciliation_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = reconciliation_matches.client_id 
      AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for ar_candidates
CREATE POLICY "Users can view AR candidates for their clients" ON ar_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = ar_candidates.client_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert AR candidates for their clients" ON ar_candidates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = ar_candidates.client_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update AR candidates for their clients" ON ar_candidates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = ar_candidates.client_id 
      AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for reconciliation_rules
CREATE POLICY "Users can view reconciliation rules for their clients" ON reconciliation_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = reconciliation_rules.client_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reconciliation rules for their clients" ON reconciliation_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = reconciliation_rules.client_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reconciliation rules for their clients" ON reconciliation_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = reconciliation_rules.client_id 
      AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for reconciliation_history
CREATE POLICY "Users can view reconciliation history for their matches" ON reconciliation_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reconciliation_matches rm
      JOIN clients c ON c.id = rm.client_id
      WHERE rm.id = reconciliation_history.match_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reconciliation history for their matches" ON reconciliation_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reconciliation_matches rm
      JOIN clients c ON c.id = rm.client_id
      WHERE rm.id = reconciliation_history.match_id 
      AND c.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reconciliation_matches_updated_at 
  BEFORE UPDATE ON reconciliation_matches 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_candidates_updated_at 
  BEFORE UPDATE ON ar_candidates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reconciliation_rules_updated_at 
  BEFORE UPDATE ON reconciliation_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create AR candidates from transactions
CREATE OR REPLACE FUNCTION create_ar_candidates_from_transactions()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create AR candidates for deposit transactions
  IF NEW.amount > 0 AND NEW.category = 'Deposit' THEN
    INSERT INTO ar_candidates (
      client_id,
      invoice_number,
      customer_name,
      amount,
      description,
      reference,
      created_at
    ) VALUES (
      NEW.client_id,
      'DEP-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(EXTRACT(DOY FROM NOW())::TEXT, 3, '0') || '-' || LPAD(NEW.id::TEXT, 6, '0'),
      COALESCE(NEW.payee, 'Unknown Customer'),
      NEW.amount,
      NEW.description,
      NEW.tx_id_ext,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create AR candidates
CREATE TRIGGER trigger_create_ar_candidates
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_ar_candidates_from_transactions();

-- Insert sample AR candidates for existing transactions (for development)
INSERT INTO ar_candidates (client_id, invoice_number, customer_name, amount, description, reference, status)
SELECT 
  t.client_id,
  'DEP-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(EXTRACT(DOY FROM NOW())::TEXT, 3, '0') || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY t.created_at)::TEXT, 6, '0'),
  COALESCE(t.payee, 'Unknown Customer'),
  t.amount,
  t.description,
  t.tx_id_ext,
  'open'
FROM transactions t
WHERE t.amount > 0 
  AND t.category = 'Deposit'
  AND NOT EXISTS (
    SELECT 1 FROM ar_candidates ar 
    WHERE ar.reference = t.tx_id_ext
  )
ON CONFLICT (reference) DO NOTHING;
