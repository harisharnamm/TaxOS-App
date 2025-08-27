-- Learning System Tables for Transaction AI Improvement
-- This migration adds tables to track user feedback and learning patterns

-- Table to store user feedback on AI suggestions
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('accepted', 'rejected', 'modified')),
  original_category TEXT,
  original_payee TEXT,
  original_confidence DECIMAL(3,2),
  user_category TEXT,
  user_payee TEXT,
  feedback_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store learning patterns based on user behavior
CREATE TABLE IF NOT EXISTS learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  payee TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.7,
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success_rate DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique patterns per user
  UNIQUE(user_id, merchant_pattern)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_transaction_id ON user_feedback(transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_user_id ON learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_merchant_pattern ON learning_patterns(merchant_pattern);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_confidence ON learning_patterns(confidence);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_success_rate ON learning_patterns(success_rate);

-- RLS Policies for user_feedback table
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON user_feedback
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for learning_patterns table
ALTER TABLE learning_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning patterns" ON learning_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning patterns" ON learning_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning patterns" ON learning_patterns
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_patterns_updated_at
  BEFORE UPDATE ON learning_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get learning analytics for a user
CREATE OR REPLACE FUNCTION get_user_learning_analytics(user_uuid UUID)
RETURNS TABLE (
  total_patterns BIGINT,
  high_confidence_patterns BIGINT,
  average_success_rate DECIMAL(5,4),
  recent_improvements BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_patterns,
    COUNT(*) FILTER (WHERE confidence >= 0.8)::BIGINT as high_confidence_patterns,
    COALESCE(AVG(success_rate), 0.0) as average_success_rate,
    COUNT(*) FILTER (WHERE last_used > NOW() - INTERVAL '30 days' AND success_rate > 0.7)::BIGINT as recent_improvements
  FROM learning_patterns
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_learning_analytics(UUID) TO authenticated;
