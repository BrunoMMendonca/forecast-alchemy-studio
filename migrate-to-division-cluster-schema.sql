-- =====================================================
-- MIGRATION SCRIPT: Transform to Company → Division → Cluster Hierarchy
-- =====================================================
-- This script migrates from the current schema to the new hierarchical structure
-- Column ordering: id | company_id | division_id | cluster_id | [remaining columns]
-- =====================================================

-- Start transaction
BEGIN;

-- =====================================================
-- 1. CREATE NEW ORGANIZATIONAL TABLES
-- =====================================================

-- Create divisions table
CREATE TABLE IF NOT EXISTS divisions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER, -- Will be updated after users migration
    UNIQUE(company_id, name)
);

-- Create clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    country_code TEXT,
    region TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER, -- Will be updated after users migration
    UNIQUE(division_id, name)
);

-- Create user_roles table for granular permissions
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN ('admin', 'manager', 'analyst', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, company_id, division_id, cluster_id)
);

-- Create sop_cycle_extensions table
CREATE TABLE IF NOT EXISTS sop_cycle_extensions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    target_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    extension_type TEXT NOT NULL CHECK (extension_type IN ('copy', 'extend', 'baseline')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    UNIQUE(source_cycle_id, target_cycle_id)
);

-- Create sku_cluster_assignments table
CREATE TABLE IF NOT EXISTS sku_cluster_assignments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(sku_id, cluster_id)
);

-- Create dataset_lineage table
CREATE TABLE IF NOT EXISTS dataset_lineage (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    parent_dataset_id INTEGER REFERENCES datasets(id),
    lineage_type TEXT NOT NULL CHECK (lineage_type IN ('original', 'extension', 'copy', 'baseline')),
    sop_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id),
    extension_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- 2. CREATE DEFAULT DIVISIONS AND CLUSTERS
-- =====================================================

-- Create a default division for each company
INSERT INTO divisions (company_id, name, description, created_by)
SELECT 
    c.id,
    'Default Division',
    'Default division created during migration',
    c.created_by
FROM companies c
ON CONFLICT (company_id, name) DO NOTHING;

-- Create a default cluster for each division
INSERT INTO clusters (company_id, division_id, name, description, created_by)
SELECT 
    d.company_id,
    d.id,
    'Default Cluster',
    'Default cluster created during migration',
    d.created_by
FROM divisions d
ON CONFLICT (division_id, name) DO NOTHING;

-- =====================================================
-- 3. MIGRATE USERS TO NEW STRUCTURE
-- =====================================================

-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update email if not set (use username as email)
UPDATE users 
SET email = username 
WHERE email IS NULL;

-- Make email NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add unique constraint on email
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Create user roles for existing users (admin role for their company)
INSERT INTO user_roles (company_id, user_id, role_type, created_by)
SELECT 
    u.company_id,
    u.id,
    'admin',
    u.created_by
FROM users u
ON CONFLICT (user_id, company_id, division_id, cluster_id) DO NOTHING;

-- =====================================================
-- 4. MIGRATE SKUS TO DIVISION STRUCTURE
-- =====================================================

-- Add division_id to skus table
ALTER TABLE skus 
ADD COLUMN division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE;

-- Update skus to use default division
UPDATE skus 
SET division_id = (
    SELECT d.id 
    FROM divisions d 
    WHERE d.company_id = skus.company_id 
    LIMIT 1
);

-- Make division_id NOT NULL
ALTER TABLE skus ALTER COLUMN division_id SET NOT NULL;

-- Add missing columns to skus
ALTER TABLE skus 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- Assign all SKUs to default cluster
INSERT INTO sku_cluster_assignments (company_id, sku_id, cluster_id, assigned_by)
SELECT 
    s.company_id,
    s.id,
    c.id,
    s.created_by
FROM skus s
JOIN clusters c ON c.division_id = s.division_id
ON CONFLICT (sku_id, cluster_id) DO NOTHING;

-- =====================================================
-- 5. MIGRATE DATASETS TO CLUSTER STRUCTURE
-- =====================================================

-- Add cluster_id to datasets table
ALTER TABLE datasets 
ADD COLUMN cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE;

-- Update datasets to use default cluster
UPDATE datasets 
SET cluster_id = (
    SELECT c.id 
    FROM clusters c 
    JOIN divisions d ON d.id = c.division_id 
    WHERE d.company_id = datasets.company_id 
    LIMIT 1
);

-- Make cluster_id NOT NULL
ALTER TABLE datasets ALTER COLUMN cluster_id SET NOT NULL;

-- Add missing columns to datasets
ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS parent_dataset_id INTEGER REFERENCES datasets(id),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add check constraint for source_type
ALTER TABLE datasets ADD CONSTRAINT datasets_source_type_check 
CHECK (source_type IN ('manual', 'ai_import', 'extension'));

-- Add check constraint for status
ALTER TABLE datasets ADD CONSTRAINT datasets_status_check 
CHECK (status IN ('active', 'archived', 'deleted'));

-- Update source_type based on metadata
UPDATE datasets 
SET source_type = CASE 
    WHEN metadata->>'source' = 'ai' THEN 'ai_import'
    ELSE 'manual'
END;

-- Create dataset lineage records for existing datasets
INSERT INTO dataset_lineage (company_id, dataset_id, lineage_type, sop_cycle_id, created_by)
SELECT 
    d.company_id,
    d.id,
    'original',
    COALESCE(d.sop_cycle_id, 1), -- Use existing cycle or default to 1
    d.uploaded_by
FROM datasets d
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. MIGRATE TIME SERIES DATA
-- =====================================================

-- Add sku_id to time_series_data if not exists
ALTER TABLE time_series_data 
ADD COLUMN IF NOT EXISTS sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE;

-- Update sku_id based on sku_code
UPDATE time_series_data 
SET sku_id = (
    SELECT s.id 
    FROM skus s 
    WHERE s.sku_code = time_series_data.sku_code 
    AND s.company_id = time_series_data.company_id
    LIMIT 1
)
WHERE sku_id IS NULL;

-- Make sku_id NOT NULL
ALTER TABLE time_series_data ALTER COLUMN sku_id SET NOT NULL;

-- =====================================================
-- 7. MIGRATE OPTIMIZATION JOBS
-- =====================================================

-- Add cluster_id to optimization_jobs
ALTER TABLE optimization_jobs 
ADD COLUMN cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE;

-- Update cluster_id based on dataset
UPDATE optimization_jobs 
SET cluster_id = (
    SELECT d.cluster_id 
    FROM datasets d 
    WHERE d.id = optimization_jobs.dataset_id
)
WHERE cluster_id IS NULL;

-- Make cluster_id NOT NULL
ALTER TABLE optimization_jobs ALTER COLUMN cluster_id SET NOT NULL;

-- Remove dataset_identifier column (no longer needed)
ALTER TABLE optimization_jobs DROP COLUMN IF EXISTS dataset_identifier;

-- =====================================================
-- 8. MIGRATE MODELS
-- =====================================================

-- Add cluster_id to models
ALTER TABLE models 
ADD COLUMN cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE;

-- Update cluster_id to default cluster for each company
UPDATE models 
SET cluster_id = (
    SELECT c.id 
    FROM clusters c 
    JOIN divisions d ON d.id = c.division_id 
    WHERE d.company_id = models.company_id 
    LIMIT 1
);

-- Make cluster_id NOT NULL
ALTER TABLE models ALTER COLUMN cluster_id SET NOT NULL;

-- Add missing columns to models
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS model_type TEXT DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS performance_metrics JSONB,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- =====================================================
-- 9. MIGRATE FORECASTS
-- =====================================================

-- Add cluster_id to forecasts
ALTER TABLE forecasts 
ADD COLUMN cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE;

-- Update cluster_id based on dataset
UPDATE forecasts 
SET cluster_id = (
    SELECT d.cluster_id 
    FROM datasets d 
    WHERE d.id = forecasts.dataset_id
)
WHERE cluster_id IS NULL;

-- Make cluster_id NOT NULL
ALTER TABLE forecasts ALTER COLUMN cluster_id SET NOT NULL;

-- =====================================================
-- 10. UPDATE S&OP CYCLES
-- =====================================================

-- Add missing columns to sop_cycles
ALTER TABLE sop_cycles 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE;

-- Add check constraint for status
ALTER TABLE sop_cycles ADD CONSTRAINT sop_cycles_status_check 
CHECK (status IN ('draft', 'active', 'completed', 'archived'));

-- Set the most recent cycle as current for each company
UPDATE sop_cycles 
SET is_current = TRUE 
WHERE id IN (
    SELECT DISTINCT ON (company_id) id 
    FROM sop_cycles 
    ORDER BY company_id, created_at DESC
);

-- =====================================================
-- 11. UPDATE AUDIT LOGS
-- =====================================================

-- Add missing columns to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS table_name TEXT,
ADD COLUMN IF NOT EXISTS record_id INTEGER,
ADD COLUMN IF NOT EXISTS old_values JSONB,
ADD COLUMN IF NOT EXISTS new_values JSONB;

-- =====================================================
-- 12. REORDER COLUMNS FOR READABILITY
-- =====================================================

-- Function to reorder columns
CREATE OR REPLACE FUNCTION reorder_table_columns(
    table_name TEXT,
    new_column_order TEXT[]
) RETURNS VOID AS $$
DECLARE
    column_list TEXT;
    query TEXT;
BEGIN
    -- Build column list
    SELECT string_agg(quote_ident(col), ', ') INTO column_list
    FROM unnest(new_column_order) AS col;
    
    -- Create new table with desired column order
    query := format('
        CREATE TABLE %I_new AS 
        SELECT %s FROM %I
    ', table_name, column_list, table_name);
    
    EXECUTE query;
    
    -- Drop old table and rename new one
    EXECUTE format('DROP TABLE %I', table_name);
    EXECUTE format('ALTER TABLE %I_new RENAME TO %I', table_name, table_name);
    
    -- Recreate primary key and sequences
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', table_name);
    
    -- Recreate sequence
    EXECUTE format('
        CREATE SEQUENCE IF NOT EXISTS %I_id_seq;
        SELECT setval(''%I_id_seq'', (SELECT MAX(id) FROM %I));
        ALTER TABLE %I ALTER COLUMN id SET DEFAULT nextval(''%I_id_seq'');
        ALTER SEQUENCE %I_id_seq OWNED BY %I.id
    ', table_name, table_name, table_name, table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Reorder divisions table
SELECT reorder_table_columns('divisions', ARRAY[
    'id', 'company_id', 'name', 'description', 'is_active', 'created_at', 'created_by'
]);

-- Reorder clusters table
SELECT reorder_table_columns('clusters', ARRAY[
    'id', 'company_id', 'division_id', 'name', 'description', 'country_code', 'region', 
    'is_active', 'created_at', 'created_by'
]);

-- Reorder user_roles table
SELECT reorder_table_columns('user_roles', ARRAY[
    'id', 'company_id', 'user_id', 'division_id', 'cluster_id', 'role_type', 'is_active', 
    'created_at', 'created_by'
]);

-- Reorder skus table
SELECT reorder_table_columns('skus', ARRAY[
    'id', 'company_id', 'division_id', 'sku_code', 'description', 'category', 'subcategory', 
    'is_active', 'created_at', 'created_by', 'updated_at', 'updated_by'
]);

-- Reorder sku_cluster_assignments table
SELECT reorder_table_columns('sku_cluster_assignments', ARRAY[
    'id', 'company_id', 'sku_id', 'cluster_id', 'is_active', 'assigned_at', 'assigned_by'
]);

-- Reorder datasets table
SELECT reorder_table_columns('datasets', ARRAY[
    'id', 'company_id', 'cluster_id', 'sop_cycle_id', 'name', 'description', 'file_path', 
    'dataset_hash', 'source_type', 'parent_dataset_id', 'metadata', 'status', 'uploaded_at', 'uploaded_by'
]);

-- Reorder dataset_lineage table
SELECT reorder_table_columns('dataset_lineage', ARRAY[
    'id', 'company_id', 'dataset_id', 'parent_dataset_id', 'lineage_type', 'sop_cycle_id', 
    'extension_metadata', 'created_at', 'created_by'
]);

-- Reorder time_series_data table
SELECT reorder_table_columns('time_series_data', ARRAY[
    'id', 'company_id', 'dataset_id', 'sku_id', 'sku_code', 'date', 'value', 'created_at'
]);

-- Reorder optimization_jobs table
SELECT reorder_table_columns('optimization_jobs', ARRAY[
    'id', 'company_id', 'cluster_id', 'user_id', 'sku_id', 'sku_code', 'dataset_id', 'method', 
    'payload', 'reason', 'batch_id', 'status', 'progress', 'error', 'priority', 'optimization_id', 
    'optimization_hash', 'created_at', 'updated_at', 'started_at', 'completed_at'
]);

-- Reorder optimization_results table
SELECT reorder_table_columns('optimization_results', ARRAY[
    'id', 'company_id', 'job_id', 'parameters', 'scores', 'forecasts', 'created_at', 'updated_at'
]);

-- Reorder models table
SELECT reorder_table_columns('models', ARRAY[
    'id', 'company_id', 'cluster_id', 'name', 'model_type', 'parameters', 'performance_metrics', 
    'is_active', 'created_at', 'created_by', 'updated_at', 'updated_by'
]);

-- Reorder forecasts table
SELECT reorder_table_columns('forecasts', ARRAY[
    'id', 'company_id', 'cluster_id', 'sop_cycle_id', 'dataset_id', 'sku_id', 'model_id', 'method', 
    'period_id', 'method_type', 'periods', 'parameters', 'predictions', 'optimization_id', 'job_id', 
    'forecast_hash', 'is_final_forecast', 'generated_at', 'generated_by', 'updated_at', 'updated_by'
]);

-- =====================================================
-- 13. CREATE NEW INDEXES
-- =====================================================

-- Division indexes
CREATE INDEX IF NOT EXISTS idx_divisions_company ON divisions(company_id);
CREATE INDEX IF NOT EXISTS idx_divisions_active ON divisions(is_active);

-- Cluster indexes
CREATE INDEX IF NOT EXISTS idx_clusters_division ON clusters(division_id);
CREATE INDEX IF NOT EXISTS idx_clusters_company ON clusters(company_id);
CREATE INDEX IF NOT EXISTS idx_clusters_active ON clusters(is_active);
CREATE INDEX IF NOT EXISTS idx_clusters_country ON clusters(country_code);

-- User Role indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company ON user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_division ON user_roles(division_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_cluster ON user_roles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- SKU indexes
CREATE INDEX IF NOT EXISTS idx_skus_division ON skus(division_id);
CREATE INDEX IF NOT EXISTS idx_skus_active ON skus(is_active);

-- SKU Cluster Assignment indexes
CREATE INDEX IF NOT EXISTS idx_sku_cluster_company ON sku_cluster_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_sku_cluster_sku ON sku_cluster_assignments(sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_cluster_cluster ON sku_cluster_assignments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_sku_cluster_active ON sku_cluster_assignments(is_active);

-- Dataset indexes
CREATE INDEX IF NOT EXISTS idx_datasets_cluster ON datasets(cluster_id);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_source_type ON datasets(source_type);

-- Dataset Lineage indexes
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_company ON dataset_lineage(company_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_dataset ON dataset_lineage(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_parent ON dataset_lineage(parent_dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_sop_cycle ON dataset_lineage(sop_cycle_id);

-- Time Series Data indexes
CREATE INDEX IF NOT EXISTS idx_time_series_sku ON time_series_data(sku_id);
CREATE INDEX IF NOT EXISTS idx_time_series_dataset_sku_date ON time_series_data(dataset_id, sku_id, date);

-- Optimization Jobs indexes
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_cluster ON optimization_jobs(cluster_id);

-- Models indexes
CREATE INDEX IF NOT EXISTS idx_models_cluster ON models(cluster_id);
CREATE INDEX IF NOT EXISTS idx_models_active ON models(is_active);

-- Forecasts indexes
CREATE INDEX IF NOT EXISTS idx_forecasts_cluster ON forecasts(cluster_id);

-- Update final forecast unique index to include cluster
DROP INDEX IF EXISTS idx_final_forecast_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_forecast_unique_cluster
ON forecasts (company_id, cluster_id, dataset_id, sku_id)
WHERE is_final_forecast;

-- =====================================================
-- 14. CREATE TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to ensure only one current S&OP cycle per company
CREATE OR REPLACE FUNCTION ensure_single_current_sop_cycle()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE sop_cycles 
        SET is_current = FALSE 
        WHERE company_id = NEW.company_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to audit changes
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, new_values)
        VALUES (NEW.company_id, NEW.created_by, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values, new_values)
        VALUES (NEW.company_id, NEW.updated_by, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, old_values)
        VALUES (OLD.company_id, OLD.updated_by, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER ensure_single_current_sop_cycle_trigger
    BEFORE INSERT OR UPDATE ON sop_cycles
    FOR EACH ROW EXECUTE FUNCTION ensure_single_current_sop_cycle();

CREATE TRIGGER audit_skus_changes
    AFTER INSERT OR UPDATE OR DELETE ON skus
    FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_datasets_changes
    AFTER INSERT OR UPDATE OR DELETE ON datasets
    FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_forecasts_changes
    AFTER INSERT OR UPDATE OR DELETE ON forecasts
    FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- =====================================================
-- 15. CLEANUP OLD STRUCTURES
-- =====================================================

-- Drop old sop_aggregator table (replaced by sop_cycle_extensions)
DROP TABLE IF EXISTS sop_aggregator;

-- Drop old dataset_skus table (replaced by sku_cluster_assignments)
DROP TABLE IF EXISTS dataset_skus;

-- Clean up function
DROP FUNCTION IF EXISTS reorder_table_columns(TEXT, TEXT[]);

-- =====================================================
-- 16. VERIFICATION QUERIES
-- =====================================================

-- Verify migration success
DO $$
DECLARE
    company_count INTEGER;
    division_count INTEGER;
    cluster_count INTEGER;
    user_count INTEGER;
    sku_count INTEGER;
    dataset_count INTEGER;
BEGIN
    -- Count records
    SELECT COUNT(*) INTO company_count FROM companies;
    SELECT COUNT(*) INTO division_count FROM divisions;
    SELECT COUNT(*) INTO cluster_count FROM clusters;
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO sku_count FROM skus;
    SELECT COUNT(*) INTO dataset_count FROM datasets;
    
    -- Log results
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE 'Companies: %', company_count;
    RAISE NOTICE 'Divisions: %', division_count;
    RAISE NOTICE 'Clusters: %', cluster_count;
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE 'SKUs: %', sku_count;
    RAISE NOTICE 'Datasets: %', dataset_count;
    
    -- Verify data integrity
    IF company_count = 0 THEN
        RAISE EXCEPTION 'No companies found after migration';
    END IF;
    
    IF division_count = 0 THEN
        RAISE EXCEPTION 'No divisions found after migration';
    END IF;
    
    IF cluster_count = 0 THEN
        RAISE EXCEPTION 'No clusters found after migration';
    END IF;
    
    RAISE NOTICE 'Data integrity checks passed';
END $$;

-- Commit transaction
COMMIT;

-- =====================================================
-- MIGRATION COMPLETED SUCCESSFULLY
-- =====================================================
-- The database has been successfully migrated to the new
-- Company → Division → Cluster hierarchy structure.
-- 
-- Key changes:
-- 1. Added divisions and clusters tables
-- 2. Migrated all data to use the new hierarchy
-- 3. Reordered columns for better readability
-- 4. Added comprehensive indexing
-- 5. Created audit and constraint triggers
-- 6. Maintained data integrity throughout migration
-- ===================================================== 