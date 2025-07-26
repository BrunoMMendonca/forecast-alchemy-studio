-- Add useful columns to companies table
-- This migration adds business-relevant fields that are commonly needed for company profiles

-- Add country column (ISO country code)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT;

-- Industry is kept at division level for multi-industry companies

-- Add website column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;

-- Add phone number
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add address information
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add company size/scale information
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise'));

-- Add fiscal year start (for financial planning)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year_start DATE;

-- Add timezone (for global operations)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add currency (for financial data)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add logo URL
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add notes/remarks
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add updated_at column for tracking changes
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(company_size);

-- Add trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at_trigger
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_companies_updated_at();

-- Update existing companies with default values if needed
UPDATE companies SET 
    country = 'US',
    company_size = 'medium',
    timezone = 'UTC',
    currency = 'USD'
WHERE country IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN companies.country IS 'ISO country code (e.g., US, CA, MX)';
COMMENT ON COLUMN companies.website IS 'Company website URL';
COMMENT ON COLUMN companies.phone IS 'Primary contact phone number';
COMMENT ON COLUMN companies.address IS 'Street address';
COMMENT ON COLUMN companies.city IS 'City';
COMMENT ON COLUMN companies.state_province IS 'State or province';
COMMENT ON COLUMN companies.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN companies.company_size IS 'Company size category';
COMMENT ON COLUMN companies.fiscal_year_start IS 'Start date of fiscal year';
COMMENT ON COLUMN companies.timezone IS 'Primary timezone for operations';
COMMENT ON COLUMN companies.currency IS 'Primary currency for financial data';
COMMENT ON COLUMN companies.logo_url IS 'URL to company logo';
COMMENT ON COLUMN companies.notes IS 'Additional notes or remarks'; 