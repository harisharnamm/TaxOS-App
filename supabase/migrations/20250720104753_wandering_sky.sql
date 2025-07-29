/*
  # Add client category field

  1. Changes
    - Add `category` column to `clients` table
    - Add check constraint for valid category values
    - Add index for category filtering

  2. Categories
    - SaaS, Real Estate, Non Profit, eCommerce, Consulting, Healthcare, Manufacturing, Retail, Restaurant, Construction, Professional Services, Technology, Other
*/

-- Add category column to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'category'
  ) THEN
    ALTER TABLE clients ADD COLUMN category text;
  END IF;
END $$;

-- Add check constraint for valid category values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'clients_category_check'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_category_check 
    CHECK (category IN (
      'saas', 'real_estate', 'non_profit', 'ecommerce', 'consulting', 
      'healthcare', 'manufacturing', 'retail', 'restaurant', 'construction', 
      'professional_services', 'technology', 'other'
    ));
  END IF;
END $$;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);

-- Update existing clients to have a default category if null
UPDATE clients SET category = 'other' WHERE category IS NULL;