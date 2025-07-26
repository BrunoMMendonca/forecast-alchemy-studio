-- Migration: Add company_id to optimization_results table (as first column)
-- This ensures proper multi-tenancy and data isolation

-- Add company_id column to optimization_results (will be added at the end initially)
ALTER TABLE optimization_results 
ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Update existing records to set company_id based on the related job
UPDATE optimization_results 
SET company_id = (
  SELECT oj.company_id 
  FROM optimization_jobs oj 
  WHERE oj.id = optimization_results.job_id
);

-- Make company_id NOT NULL after populating existing data
ALTER TABLE optimization_results 
ALTER COLUMN company_id SET NOT NULL;

-- Reorder columns to put company_id first
-- PostgreSQL doesn't have a direct "ALTER TABLE ... REORDER COLUMNS" command,
-- so we need to recreate the table with the desired column order

-- Create new table with desired column order
CREATE TABLE optimization_results_new (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES optimization_jobs(id) ON DELETE CASCADE,
    parameters JSONB,
    scores JSONB,
    forecasts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Copy data from old table to new table
INSERT INTO optimization_results_new (company_id, id, job_id, parameters, scores, forecasts, created_at, updated_at)
SELECT company_id, id, job_id, parameters, scores, forecasts, created_at, updated_at
FROM optimization_results;

-- Drop old table and rename new table
DROP TABLE optimization_results;
ALTER TABLE optimization_results_new RENAME TO optimization_results;

-- Recreate the sequence for the id column
CREATE SEQUENCE IF NOT EXISTS optimization_results_id_seq;
SELECT setval('optimization_results_id_seq', (SELECT MAX(id) FROM optimization_results));
ALTER TABLE optimization_results ALTER COLUMN id SET DEFAULT nextval('optimization_results_id_seq');
ALTER SEQUENCE optimization_results_id_seq OWNED BY optimization_results.id;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_optimization_results_company_id 
ON optimization_results(company_id);

CREATE INDEX IF NOT EXISTS idx_optimization_results_company_job 
ON optimization_results(company_id, job_id);

-- Add the updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_optimization_results_updated_at 
    BEFORE UPDATE ON optimization_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'optimization_results' 
-- ORDER BY ordinal_position; 