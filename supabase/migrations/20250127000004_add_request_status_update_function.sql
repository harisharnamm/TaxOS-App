-- Function to update document request status based on upload progress
CREATE OR REPLACE FUNCTION update_document_request_status()
RETURNS TRIGGER AS $$
DECLARE
    request_id UUID;
    total_items INTEGER;
    uploaded_items INTEGER;
    new_status TEXT;
BEGIN
    -- Get the request_id from the updated/inserted record
    IF TG_OP = 'DELETE' THEN
        request_id := OLD.request_id;
    ELSE
        request_id := NEW.request_id;
    END IF;
    
    -- Count total and uploaded items for this request
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'uploaded') as uploaded
    INTO total_items, uploaded_items
    FROM document_request_items
    WHERE request_id = update_document_request_status.request_id;
    
    -- Determine new status
    IF uploaded_items = 0 THEN
        new_status := 'pending';
    ELSIF uploaded_items = total_items THEN
        new_status := 'complete';
    ELSE
        new_status := 'partial';
    END IF;
    
    -- Update the document request status
    UPDATE document_requests 
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update status when document_request_items change
CREATE TRIGGER trigger_update_document_request_status
    AFTER INSERT OR UPDATE OR DELETE ON document_request_items
    FOR EACH ROW
    EXECUTE FUNCTION update_document_request_status(); 