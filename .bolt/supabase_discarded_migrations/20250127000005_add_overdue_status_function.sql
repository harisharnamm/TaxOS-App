-- Function to mark overdue requests
CREATE OR REPLACE FUNCTION mark_overdue_requests()
RETURNS void AS $$
BEGIN
    UPDATE document_requests 
    SET 
        status = 'overdue',
        updated_at = NOW()
    WHERE 
        due_date < NOW() 
        AND status IN ('pending', 'partial');
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run this function daily (optional)
-- This would require pg_cron extension which may not be available in all Supabase plans
-- For now, we'll rely on manual calls or application-level checks 