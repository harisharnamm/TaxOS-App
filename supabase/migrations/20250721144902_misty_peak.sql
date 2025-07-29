/*
  # Update Document Processing Schema

  1. Database Changes
    - Drop irs_notices table (no longer needed)
    - Add eden_ai_classification column to documents table
    - Add eden_ai_processed_data column to documents table
    - Update triggers and constraints

  2. Security
    - Maintain existing RLS policies on documents table
    - Clean up any references to irs_notices table

  3. Data Migration
    - Safely remove irs_notices table and related data
*/

-- First, drop the irs_notices table and its dependencies
DROP TABLE IF EXISTS public.irs_notices CASCADE;

-- Add new columns to documents table for Eden AI processing
DO $$
BEGIN
  -- Add eden_ai_classification column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'eden_ai_classification'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN eden_ai_classification text;
  END IF;

  -- Add eden_ai_processed_data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'eden_ai_processed_data'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN eden_ai_processed_data jsonb;
  END IF;
END $$;

-- Add index for classification searches
CREATE INDEX IF NOT EXISTS idx_documents_classification 
ON public.documents (eden_ai_classification);

-- Add index for processed data searches
CREATE INDEX IF NOT EXISTS idx_documents_processed_data 
ON public.documents USING gin (eden_ai_processed_data);

-- Update the search vector trigger to include new classification field
CREATE OR REPLACE FUNCTION update_documents_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.original_filename, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.ocr_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.ai_summary, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.eden_ai_classification, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;