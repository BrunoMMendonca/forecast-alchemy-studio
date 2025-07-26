-- =====================================================
-- CREATE FRESH DATABASE WITH NEW SCHEMA
-- Company → Division → Cluster Hierarchy
-- =====================================================
-- This script drops the old database and creates a fresh one
-- with the new hierarchical structure
-- =====================================================

-- =====================================================
-- 1. DROP EXISTING DATABASE (if exists)
-- =====================================================

-- Note: You'll need to run this from a different database or as superuser
-- since you can't drop a database while connected to it

-- Connect to postgres database first, then run:
-- DROP DATABASE IF EXISTS forecast_alchemy_studio;

-- Then create the new database:
-- CREATE DATABASE forecast_alchemy_studio;

-- =====================================================
-- 2. CREATE FRESH SCHEMA
-- =====================================================

-- =====================================================
-- CORE ORGANIZATIONAL STRUCTURE
-- =====================================================

-- Companies (Organizations) - Top level
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    country TEXT, -- ISO country code (e.g., 'US', 'CA', 'MX')
    website TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    fiscal_year_start DATE,
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    logo_url TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER, -- Self-reference for first company
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Divisions (manage SKU portfolios with total segregation)
CREATE TABLE divisions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER, -- Will reference users(id) after users table is created
    UNIQUE(company_id, name)
);

-- Clusters (different sales data, multiple clusters can sell same SKU)
CREATE TABLE clusters (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    country_code TEXT, -- ISO country code (e.g., 'US', 'CA', 'MX')
    region TEXT, -- Geographic region
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER, -- Will reference users(id) after users table is created
    UNIQUE(division_id, name)
);

-- =====================================================
-- USER MANAGEMENT & PERMISSIONS
-- =====================================================

-- Users (multi-role, multi-company)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- User Roles (extended for division and cluster management)
CREATE TABLE user_roles (
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

-- =====================================================
-- S&OP CYCLE MANAGEMENT
-- =====================================================

-- S&OP Cycles (per division)
CREATE TABLE sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    is_current BOOLEAN DEFAULT FALSE, -- Only one current cycle per division
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    UNIQUE(division_id, name)
);

-- S&OP Cycle Extensions (for extending datasets to new cycles)
CREATE TABLE sop_cycle_extensions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    source_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    target_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
    extension_type TEXT NOT NULL CHECK (extension_type IN ('copy', 'extend', 'baseline')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    metadata JSONB, -- Extension-specific data
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    UNIQUE(source_cycle_id, target_cycle_id)
);

-- =====================================================
-- SKU MANAGEMENT
-- =====================================================

-- SKUs (can be shared across divisions, but each division manages its own data)
CREATE TABLE skus (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, sku_code) -- Same SKU can exist in different divisions
);

-- SKU-Cluster Relationships (which clusters sell which SKUs)
CREATE TABLE sku_cluster_assignments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(sku_id, cluster_id)
);

-- SKU Cross-Division Relationships (tracking when same SKU exists in multiple divisions)
CREATE TABLE sku_cross_division_relationships (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    target_sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('copy', 'reference', 'shared')),
    source_division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    target_division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    metadata JSONB, -- Additional relationship data
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(source_sku_id, target_sku_id)
);

-- =====================================================
-- DATASET MANAGEMENT
-- =====================================================

-- Datasets (linked to clusters with division for performance)
CREATE TABLE datasets (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    sop_cycle_id INTEGER REFERENCES sop_cycles(id),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    dataset_hash TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'ai_import', 'extension')),
    parent_dataset_id INTEGER REFERENCES datasets(id), -- For dataset extensions
    metadata JSONB, -- Import metadata, column mappings, etc.
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    uploaded_by INTEGER REFERENCES users(id),
    UNIQUE(cluster_id, name)
);

-- Dataset Lineage (tracking dataset versions and extensions)
CREATE TABLE dataset_lineage (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    parent_dataset_id INTEGER REFERENCES datasets(id),
    lineage_type TEXT NOT NULL CHECK (lineage_type IN ('original', 'extension', 'copy', 'baseline')),
    sop_cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id),
    extension_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- TIME SERIES DATA
-- =====================================================

-- Time Series Data (the actual imported data)
CREATE TABLE time_series_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL, -- Denormalized for performance
    date DATE NOT NULL,
    value REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(dataset_id, sku_id, date)
);

-- =====================================================
-- FORECASTING & OPTIMIZATION
-- =====================================================

-- Optimization Jobs (job metadata and status tracking)
CREATE TABLE optimization_jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL, -- Denormalized for performance
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    payload JSONB,
    reason TEXT,
    batch_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
    progress INTEGER DEFAULT 0,
    error TEXT,
    priority INTEGER DEFAULT 1,
    optimization_id TEXT,
    optimization_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Optimization Results (shared across cluster, job_id for audit only)
CREATE TABLE optimization_results (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES optimization_jobs(id) ON DELETE SET NULL, -- For audit only
    optimization_hash TEXT NOT NULL, -- For deduplication and sharing
    parameters JSONB,
    scores JSONB,
    forecasts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(cluster_id, optimization_hash) -- Same optimization can be shared across cluster
);

-- Models (optimized forecasting models)
CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    parameters JSONB,
    performance_metrics JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id)
);

-- Forecasts
CREATE TABLE forecasts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    sop_cycle_id INTEGER REFERENCES sop_cycles(id),
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    model_id INTEGER REFERENCES models(id),
    method TEXT NOT NULL,
    period_id TEXT NOT NULL,
    method_type TEXT NOT NULL,
    periods INTEGER NOT NULL,
    parameters JSONB NOT NULL,
    predictions JSONB NOT NULL,
    optimization_id TEXT,
    job_id INTEGER REFERENCES optimization_jobs(id),
    forecast_hash TEXT,
    is_final_forecast BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMPTZ NOT NULL,
    generated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- AGGREGATION & HIERARCHY MANAGEMENT
-- =====================================================

-- Aggregatable Field Definitions (per company)
CREATE TABLE aggregatable_field_defs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    options JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, field_name)
);

-- SKU Aggregatable Field Values
CREATE TABLE sku_aggregatable_values (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(sku_id, field_def_id)
);

-- SKU Aggregatable Field Value History
CREATE TABLE sku_aggregatable_value_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    value TEXT,
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id)
);

-- Dataset Aggregatable Field Mapping
CREATE TABLE dataset_aggregatable_field_map (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    dataset_column TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- SETTINGS & CONFIGURATION
-- =====================================================

-- Company Settings
CREATE TABLE company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, key)
);

-- User Settings
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, user_id, key)
);

-- =====================================================
-- AUDIT & TRACKING
-- =====================================================

-- Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Trend Lines
CREATE TABLE trend_lines (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    start_index INTEGER NOT NULL,
    end_index INTEGER NOT NULL,
    start_value REAL NOT NULL,
    end_value REAL NOT NULL,
    start_date DATE,
    end_date DATE,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Company indexes
CREATE INDEX idx_companies_active ON companies(is_active);
CREATE INDEX idx_companies_country ON companies(country);
CREATE INDEX idx_companies_size ON companies(company_size);

-- Division indexes
CREATE INDEX idx_divisions_company ON divisions(company_id);
CREATE INDEX idx_divisions_active ON divisions(is_active);

-- Cluster indexes
CREATE INDEX idx_clusters_division ON clusters(division_id);
CREATE INDEX idx_clusters_company ON clusters(company_id);
CREATE INDEX idx_clusters_active ON clusters(is_active);
CREATE INDEX idx_clusters_country ON clusters(country_code);

-- User indexes
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_email ON users(email);

-- User Role indexes
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_company ON user_roles(company_id);
CREATE INDEX idx_user_roles_division ON user_roles(division_id);
CREATE INDEX idx_user_roles_cluster ON user_roles(cluster_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);

-- S&OP Cycle indexes
CREATE INDEX idx_sop_cycles_company ON sop_cycles(company_id);
CREATE INDEX idx_sop_cycles_division ON sop_cycles(division_id);
CREATE INDEX idx_sop_cycles_status ON sop_cycles(status);
CREATE INDEX idx_sop_cycles_current ON sop_cycles(is_current);

-- SKU indexes
CREATE INDEX idx_skus_company ON skus(company_id);
CREATE INDEX idx_skus_division ON skus(division_id);
CREATE INDEX idx_skus_active ON skus(is_active);
CREATE INDEX idx_skus_code ON skus(sku_code);

-- SKU Cluster Assignment indexes
CREATE INDEX idx_sku_cluster_company ON sku_cluster_assignments(company_id);
CREATE INDEX idx_sku_cluster_sku ON sku_cluster_assignments(sku_id);
CREATE INDEX idx_sku_cluster_cluster ON sku_cluster_assignments(cluster_id);
CREATE INDEX idx_sku_cluster_active ON sku_cluster_assignments(is_active);

-- SKU Cross-Division Relationship indexes
CREATE INDEX idx_sku_cross_division_company ON sku_cross_division_relationships(company_id);
CREATE INDEX idx_sku_cross_division_source_sku ON sku_cross_division_relationships(source_sku_id);
CREATE INDEX idx_sku_cross_division_target_sku ON sku_cross_division_relationships(target_sku_id);
CREATE INDEX idx_sku_cross_division_source_division ON sku_cross_division_relationships(source_division_id);
CREATE INDEX idx_sku_cross_division_target_division ON sku_cross_division_relationships(target_division_id);
CREATE INDEX idx_sku_cross_division_type ON sku_cross_division_relationships(relationship_type);

-- Dataset indexes
CREATE INDEX idx_datasets_company ON datasets(company_id);
CREATE INDEX idx_datasets_division ON datasets(division_id);
CREATE INDEX idx_datasets_cluster ON datasets(cluster_id);
CREATE INDEX idx_datasets_sop_cycle ON datasets(sop_cycle_id);
CREATE INDEX idx_datasets_status ON datasets(status);
CREATE INDEX idx_datasets_source_type ON datasets(source_type);

-- Dataset Lineage indexes
CREATE INDEX idx_dataset_lineage_company ON dataset_lineage(company_id);
CREATE INDEX idx_dataset_lineage_division ON dataset_lineage(division_id);
CREATE INDEX idx_dataset_lineage_dataset ON dataset_lineage(dataset_id);
CREATE INDEX idx_dataset_lineage_parent ON dataset_lineage(parent_dataset_id);
CREATE INDEX idx_dataset_lineage_sop_cycle ON dataset_lineage(sop_cycle_id);

-- Time Series Data indexes
CREATE INDEX idx_time_series_company ON time_series_data(company_id);
CREATE INDEX idx_time_series_dataset ON time_series_data(dataset_id);
CREATE INDEX idx_time_series_sku ON time_series_data(sku_id);
CREATE INDEX idx_time_series_date ON time_series_data(date);
CREATE INDEX idx_time_series_dataset_sku_date ON time_series_data(dataset_id, sku_id, date);

-- Optimization Jobs indexes
CREATE INDEX idx_optimization_jobs_company ON optimization_jobs(company_id);
CREATE INDEX idx_optimization_jobs_division ON optimization_jobs(division_id);
CREATE INDEX idx_optimization_jobs_cluster ON optimization_jobs(cluster_id);
CREATE INDEX idx_optimization_jobs_user ON optimization_jobs(user_id);
CREATE INDEX idx_optimization_jobs_sku ON optimization_jobs(sku_id);
CREATE INDEX idx_optimization_jobs_dataset ON optimization_jobs(dataset_id);
CREATE INDEX idx_optimization_jobs_status ON optimization_jobs(status);
CREATE INDEX idx_optimization_jobs_batch ON optimization_jobs(batch_id);
CREATE INDEX idx_optimization_jobs_hash ON optimization_jobs(optimization_hash);

-- Optimization Results indexes
CREATE INDEX idx_optimization_results_company ON optimization_results(company_id);
CREATE INDEX idx_optimization_results_division ON optimization_results(division_id);
CREATE INDEX idx_optimization_results_cluster ON optimization_results(cluster_id);
CREATE INDEX idx_optimization_results_job ON optimization_results(job_id);
CREATE INDEX idx_optimization_results_hash ON optimization_results(optimization_hash);
CREATE INDEX idx_optimization_results_cluster_hash ON optimization_results(cluster_id, optimization_hash);

-- Models indexes
CREATE INDEX idx_models_company ON models(company_id);
CREATE INDEX idx_models_division ON models(division_id);
CREATE INDEX idx_models_cluster ON models(cluster_id);
CREATE INDEX idx_models_active ON models(is_active);

-- Forecasts indexes
CREATE INDEX idx_forecasts_company ON forecasts(company_id);
CREATE INDEX idx_forecasts_division ON forecasts(division_id);
CREATE INDEX idx_forecasts_cluster ON forecasts(cluster_id);
CREATE INDEX idx_forecasts_dataset_sku ON forecasts(dataset_id, sku_id);
CREATE INDEX idx_forecasts_final ON forecasts(is_final_forecast);
CREATE INDEX idx_forecasts_hash ON forecasts(forecast_hash);

-- Add a partial unique index for final forecasts per cluster
CREATE UNIQUE INDEX idx_final_forecast_unique_cluster
ON forecasts (company_id, division_id, cluster_id, dataset_id, sku_id)
WHERE is_final_forecast;

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to ensure only one current S&OP cycle per division
CREATE OR REPLACE FUNCTION ensure_single_current_sop_cycle()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE sop_cycles 
        SET is_current = FALSE 
        WHERE division_id = NEW.division_id AND id != NEW.id;
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

-- =====================================================
-- APPLY TRIGGERS
-- =====================================================

-- Update triggers for updated_at columns
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skus_updated_at 
    BEFORE UPDATE ON skus 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at 
    BEFORE UPDATE ON models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forecasts_updated_at 
    BEFORE UPDATE ON forecasts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_jobs_updated_at 
    BEFORE UPDATE ON optimization_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_results_updated_at 
    BEFORE UPDATE ON optimization_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at 
    BEFORE UPDATE ON company_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sku_aggregatable_values_updated_at 
    BEFORE UPDATE ON sku_aggregatable_values 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- S&OP cycle current trigger
CREATE TRIGGER ensure_single_current_sop_cycle_trigger
    BEFORE INSERT OR UPDATE ON sop_cycles
    FOR EACH ROW EXECUTE FUNCTION ensure_single_current_sop_cycle();

-- Audit triggers for key tables
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
-- INITIAL DATA
-- =====================================================

-- Insert a default company
INSERT INTO companies (id, name, description) 
VALUES (1, 'Default Company', 'Default company for initial setup');

-- Insert a default division
INSERT INTO divisions (company_id, name, description, created_by)
VALUES (1, 'Default Division', 'Default division for initial setup', 1);

-- Insert a default cluster
INSERT INTO clusters (company_id, division_id, name, description, created_by)
VALUES (1, 1, 'Default Cluster', 'Default cluster for initial setup', 1);

-- Insert a default user (you'll need to update password_hash)
INSERT INTO users (id, company_id, username, email, password_hash, first_name, last_name, created_by)
VALUES (1, 1, 'admin', 'admin@company.com', 'temporary_hash_change_me', 'Admin', 'User', 1);

-- Create admin role for the default user
INSERT INTO user_roles (company_id, user_id, role_type, created_by)
VALUES (1, 1, 'admin', 1);

-- Insert a default S&OP cycle
INSERT INTO sop_cycles (company_id, division_id, name, description, start_date, end_date, is_current, created_by)
VALUES (1, 1, 'Q1 2024', 'Default S&OP cycle', '2024-01-01', '2024-03-31', TRUE, 1);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify the setup
SELECT 
    'Database created successfully!' as status,
    (SELECT COUNT(*) FROM companies) as companies,
    (SELECT COUNT(*) FROM divisions) as divisions,
    (SELECT COUNT(*) FROM clusters) as clusters,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM sop_cycles) as sop_cycles;

-- =====================================================
-- NEXT STEPS
-- =====================================================
-- 1. Update the admin user's password_hash with a proper hash
-- 2. Create additional divisions and clusters as needed
-- 3. Add more users with appropriate roles
-- 4. Start using the new hierarchical structure
-- ===================================================== 