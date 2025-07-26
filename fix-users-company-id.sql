-- Fix users table to allow company_id to be nullable
-- This allows users to be created before they have a company

-- Make company_id nullable
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN users.company_id IS 'Company ID - can be NULL for users who have not created a company yet'; 