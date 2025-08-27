-- Create real-time events table for live transaction updates
CREATE TABLE IF NOT EXISTS realtime_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_realtime_events_type ON realtime_events(event_type);
CREATE INDEX IF NOT EXISTS idx_realtime_events_transaction ON realtime_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created ON realtime_events(created_at);
CREATE INDEX IF NOT EXISTS idx_realtime_events_unprocessed ON realtime_events(processed) WHERE processed = FALSE;

-- Add RLS policies
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see events for their own transactions
CREATE POLICY "Users can view realtime events for their transactions" ON realtime_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = realtime_events.transaction_id
      AND t.user_id = auth.uid()
    )
  );

-- Policy: Service role can insert events (for webhook)
CREATE POLICY "Service role can insert realtime events" ON realtime_events
  FOR INSERT WITH CHECK (true);

-- Policy: Service role can update events
CREATE POLICY "Service role can update realtime events" ON realtime_events
  FOR UPDATE USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_realtime_events_updated_at 
  BEFORE UPDATE ON realtime_events 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Cleanup old events (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_realtime_events()
RETURNS void AS $$
BEGIN
  DELETE FROM realtime_events 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old events (optional)
-- This would be configured in Supabase dashboard
