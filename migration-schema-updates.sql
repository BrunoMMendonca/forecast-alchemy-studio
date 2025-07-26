-- =====================================================
-- DATABASE SCHEMA MIGRATION SCRIPT
-- Based on DB.csv changes from Current to Future state
-- =====================================================

-- Set transaction isolation level
BEGIN;

-- =====================================================
-- 1. ADD AUDIT FIELDS TO EXISTING TABLES
-- =====================================================

-- Add created_by to aggregatable_field_defs
ALTER TABLE aggregatable_field_defs 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Add created_by to companies
ALTER TABLE companies 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Add updated_by to company_settings
ALTER TABLE company_settings 
ADD COLUMN updated_by INTEGER REFERENCES users(id);

-- Add created_by to dataset_aggregatable_field_map
ALTER TABLE dataset_aggregatable_field_map 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Add updated_at and updated_by to dataset_skus
ALTER TABLE dataset_skus 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_by INTEGER REFERENCES users(id);

-- Add sop_cycle_id and dataset_hash to datasets, reorder fields
-- First add new columns
ALTER TABLE datasets 
ADD COLUMN sop_cycle_id INTEGER REFERENCES sop_cycles(id),
ADD COLUMN dataset_hash TEXT;

-- Add generated_by and updated_by to forecasts
ALTER TABLE forecasts 
ADD COLUMN generated_by INTEGER REFERENCES users(id),
ADD COLUMN updated_by INTEGER REFERENCES users(id);

-- Add created_by to models
ALTER TABLE models 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Remove file_path from optimization_jobs (Future state shows it's removed)
ALTER TABLE optimization_jobs 
DROP COLUMN file_path;

-- Add created_by to sku_aggregatable_value_history
-- Note: company_id is already present, just reordering
ALTER TABLE sku_aggregatable_value_history 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Add updated_by to sku_aggregatable_values
ALTER TABLE sku_aggregatable_values 
ADD COLUMN updated_by INTEGER REFERENCES users(id);

-- Add created_by to skus
ALTER TABLE skus 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Add created_by to trend_lines
ALTER TABLE trend_lines 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- Add created_by to users
ALTER TABLE users 
ADD COLUMN created_by INTEGER REFERENCES users(id);

-- =====================================================
-- 2. CREATE NEW TABLE: sop_aggregator
-- =====================================================

CREATE TABLE sop_aggregator (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    sop_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- 3. RENAME TABLE: settings -> user_settings
-- =====================================================

-- First create the new table with the new structure
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old settings table (if any exists)
INSERT INTO user_settings (company_id, user_id, key, value, updated_at)
SELECT 1, 1, key, value, updated_at FROM settings;

-- Drop the old table
DROP TABLE settings;

-- =====================================================
-- 4. REORDER FIELDS IN time_series_data
-- =====================================================

-- Create new table with desired column order
CREATE TABLE time_series_data_new (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    dataset_id INTEGER NOT NULL REFERENCES datasets(id),
    sku_code TEXT NOT NULL,
    date DATE NOT NULL,
    value NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table
INSERT INTO time_series_data_new (id, company_id, dataset_id, sku_code, date, value, created_at)
SELECT id, company_id, dataset_id, sku_code, date, value, created_at 
FROM time_series_data;

-- Drop old table and rename new one
DROP TABLE time_series_data;
ALTER TABLE time_series_data_new RENAME TO time_series_data;

-- =====================================================
-- 5. REORDER FIELDS IN sku_aggregatable_value_history
-- =====================================================

-- Create new table with desired column order
CREATE TABLE sku_aggregatable_value_history_new (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    sku_id INTEGER NOT NULL REFERENCES skus(id),
    field_def_id INTEGER NOT NULL REFERENCES aggregatable_field_defs(id),
    value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id)
);

-- Copy data from old table
INSERT INTO sku_aggregatable_value_history_new (id, company_id, sku_id, field_def_id, value, changed_at, changed_by)
SELECT id, company_id, sku_id, field_def_id, value, changed_at, changed_by 
FROM sku_aggregatable_value_history;

-- Drop old table and rename new one
DROP TABLE sku_aggregatable_value_history;
ALTER TABLE sku_aggregatable_value_history_new RENAME TO sku_aggregatable_value_history;

-- =====================================================
-- 6. REMOVE accuracy FROM forecasts (as per notes)
-- =====================================================

ALTER TABLE forecasts 
DROP COLUMN accuracy;

-- =====================================================
-- 7. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Add indexes for foreign keys and commonly queried fields
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_company ON datasets(company_id);
CREATE INDEX IF NOT EXISTS idx_skus_company ON skus(company_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_company ON forecasts(company_id);
CREATE INDEX IF NOT EXISTS idx_time_series_data_company ON time_series_data(company_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_company_user ON user_settings(company_id, user_id);

-- =====================================================
-- 8. UPDATE TRIGGERS FOR AUDIT FIELDS (if needed)
-- =====================================================

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_company_settings_updated_at 
    BEFORE UPDATE ON company_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dataset_skus_updated_at 
    BEFORE UPDATE ON dataset_skus 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sku_aggregatable_values_updated_at 
    BEFORE UPDATE ON sku_aggregatable_values 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forecasts_updated_at 
    BEFORE UPDATE ON forecasts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMIT ALL CHANGES
-- =====================================================

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify all tables have the expected structure
SELECT 'aggregatable_field_defs' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'aggregatable_field_defs' 
ORDER BY ordinal_position;

SELECT 'user_settings' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
ORDER BY ordinal_position;

SELECT 'time_series_data' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_series_data' 
ORDER BY ordinal_position;

-- Check if sop_aggregator table was created
SELECT 'sop_aggregator' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sop_aggregator' 
ORDER BY ordinal_position; 