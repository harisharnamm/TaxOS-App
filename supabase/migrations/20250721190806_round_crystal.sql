/*
  # Add separate columns for document processing results

  1. Schema Changes
    - Rename `eden_ai_processed_data` to `classification_api_response`
    - Add `financial_processing_response` column for financial document results
    - Add `identity_processing_response` column for identity document results  
    - Add `tax_processing_response` column for tax document results
    - Add `processing_status` column to track processing state

  2. Data Migration
    - Migrate existing data from old column to new column
    - Set appropriate processing status for existing documents
*/

-- Add new columns
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS classification_api_response jsonb,
ADD COLUMN IF NOT EXISTS financial_processing_response jsonb,
ADD COLUMN IF NOT EXISTS identity_processing_response jsonb,
ADD COLUMN IF NOT EXISTS tax_processing_response jsonb,
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending';

-- Add check constraint for processing_status
ALTER TABLE documents 
ADD CONSTRAINT documents_processing_status_check 
CHECK (processing_status IN ('pending', 'ocr_complete', 'classified', 'processing', 'completed', 'failed'));

-- Migrate existing data from eden_ai_processed_data to classification_api_response
UPDATE documents 
SET classification_api_response = eden_ai_processed_data,
    processing_status = CASE 
      WHEN eden_ai_processed_data IS NOT NULL AND eden_ai_classification IS NOT NULL THEN 'classified'
      WHEN eden_ai_classification IS NOT NULL THEN 'classified'
      WHEN ocr_text IS NOT NULL THEN 'ocr_complete'
      ELSE 'pending'
    END
WHERE eden_ai_processed_data IS NOT NULL;

-- Drop the old column after migration
ALTER TABLE documents DROP COLUMN IF EXISTS eden_ai_processed_data;

-- Add index for processing_status for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);