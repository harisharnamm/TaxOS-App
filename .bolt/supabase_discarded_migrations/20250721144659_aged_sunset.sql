```sql
-- Drop the irs_notices table
DROP TABLE IF EXISTS public.irs_notices;

-- Add eden_ai_classification column to public.documents
ALTER TABLE public.documents
ADD COLUMN eden_ai_classification TEXT;

-- Add eden_ai_processed_data column to public.documents
ALTER TABLE public.documents
ADD COLUMN eden_ai_processed_data JSONB;
```