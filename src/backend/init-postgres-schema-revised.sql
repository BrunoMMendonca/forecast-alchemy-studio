-- =====================================================
-- REVISED POSTGRESQL SCHEMA FOR FORECAST ALCHEMY STUDIO
-- Company → Division → Cluster Hierarchy
-- =====================================================

-- =====================================================
-- 1. CORE ORGANIZATIONAL STRUCTURE
-- =====================================================

-- Companies (Organizations) - Top level
CREATE TABLE IF NOT EXISTS companies (
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
CREATE TABLE IF NOT EXISTS divisions (
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
CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
-- 2. USER MANAGEMENT & PERMISSIONS
-- =====================================================

-- Users (multi-role, multi-company)
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    division_id INTEGER REFERENCES divisions(id) ON DELETE CASCADE,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN ('company_admin', 'division_admin', 'cluster_admin', 'analyst', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, company_id, division_id, cluster_id)
);

-- User Invitations (for new user registration)
CREATE TABLE IF NOT EXISTS user_invitations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    temporary_password_hash TEXT NOT NULL,
    assigned_roles JSONB, -- Array of role assignments
    invitation_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    accepted_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- 3. S&OP CYCLE MANAGEMENT
-- =====================================================

-- S&OP Cycles (per company)
CREATE TABLE IF NOT EXISTS sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    is_current BOOLEAN DEFAULT FALSE, -- Only one current cycle per company
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    UNIQUE(company_id, name)
);

-- S&OP Cycle Extensions (for extending datasets to new cycles)
CREATE TABLE IF NOT EXISTS sop_cycle_extensions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
-- 4. SKU MANAGEMENT
-- =====================================================

-- SKUs (owned by divisions, can be sold by multiple clusters)
CREATE TABLE IF NOT EXISTS skus (
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
    UNIQUE(company_id, sku_code)
);

-- SKU-Cluster Relationships (which clusters sell which SKUs)
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

-- =====================================================
-- 5. DATASET MANAGEMENT
-- =====================================================

-- Datasets (linked to clusters)
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
    created_by INTEGER REFERENCES users(id),
    UNIQUE(cluster_id, name)
);

-- Dataset Lineage (tracking dataset versions and extensions)
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
-- 6. TIME SERIES DATA
-- =====================================================

-- Time Series Data (the actual imported data)
CREATE TABLE IF NOT EXISTS time_series_data (
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
-- 7. FORECASTING & OPTIMIZATION
-- =====================================================

-- Optimization Jobs (job metadata and status tracking)
CREATE TABLE IF NOT EXISTS optimization_jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

-- Optimization Results (optimization results and data)
CREATE TABLE IF NOT EXISTS optimization_results (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES optimization_jobs(id) ON DELETE CASCADE,
    parameters JSONB,
    scores JSONB,
    forecasts JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Models (optimized forecasting models)
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS forecasts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
-- 8. AGGREGATION & HIERARCHY MANAGEMENT
-- =====================================================

-- Aggregatable Field Definitions (per company)
CREATE TABLE IF NOT EXISTS aggregatable_field_defs (
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
CREATE TABLE IF NOT EXISTS sku_aggregatable_values (
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
CREATE TABLE IF NOT EXISTS sku_aggregatable_value_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    value TEXT,
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id)
);

-- Company Field Mapping (formerly Dataset Aggregatable Field Mapping)
CREATE TABLE IF NOT EXISTS dataset_aggregatable_field_map (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    dataset_column TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- 9. SETTINGS & CONFIGURATION
-- =====================================================

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, key)
);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, user_id, key)
);

-- =====================================================
-- 10. AUDIT & TRACKING
-- =====================================================

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
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
CREATE TABLE IF NOT EXISTS trend_lines (
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
-- 11. INDEXES FOR PERFORMANCE
-- =====================================================

-- Company indexes
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(company_size);

-- Division indexes
CREATE INDEX IF NOT EXISTS idx_divisions_company ON divisions(company_id);
CREATE INDEX IF NOT EXISTS idx_divisions_active ON divisions(is_active);

-- Cluster indexes
CREATE INDEX IF NOT EXISTS idx_clusters_division ON clusters(division_id);
CREATE INDEX IF NOT EXISTS idx_clusters_company ON clusters(company_id);
CREATE INDEX IF NOT EXISTS idx_clusters_active ON clusters(is_active);
CREATE INDEX IF NOT EXISTS idx_clusters_country ON clusters(country_code);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User Role indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company ON user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_division ON user_roles(division_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_cluster ON user_roles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- S&OP Cycle indexes
CREATE INDEX IF NOT EXISTS idx_sop_cycles_company ON sop_cycles(company_id);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_status ON sop_cycles(status);
CREATE INDEX IF NOT EXISTS idx_sop_cycles_current ON sop_cycles(is_current);

-- SKU indexes
CREATE INDEX IF NOT EXISTS idx_skus_company ON skus(company_id);
CREATE INDEX IF NOT EXISTS idx_skus_division ON skus(division_id);
CREATE INDEX IF NOT EXISTS idx_skus_active ON skus(is_active);
CREATE INDEX IF NOT EXISTS idx_skus_code ON skus(sku_code);

-- SKU Cluster Assignment indexes
CREATE INDEX IF NOT EXISTS idx_sku_cluster_company ON sku_cluster_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_sku_cluster_sku ON sku_cluster_assignments(sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_cluster_cluster ON sku_cluster_assignments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_sku_cluster_active ON sku_cluster_assignments(is_active);

-- Dataset indexes
CREATE INDEX IF NOT EXISTS idx_datasets_company ON datasets(company_id);
CREATE INDEX IF NOT EXISTS idx_datasets_cluster ON datasets(cluster_id);
CREATE INDEX IF NOT EXISTS idx_datasets_sop_cycle ON datasets(sop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_source_type ON datasets(source_type);

-- Dataset Lineage indexes
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_company ON dataset_lineage(company_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_dataset ON dataset_lineage(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_parent ON dataset_lineage(parent_dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_sop_cycle ON dataset_lineage(sop_cycle_id);

-- Time Series Data indexes
CREATE INDEX IF NOT EXISTS idx_time_series_company ON time_series_data(company_id);
CREATE INDEX IF NOT EXISTS idx_time_series_dataset ON time_series_data(dataset_id);
CREATE INDEX IF NOT EXISTS idx_time_series_sku ON time_series_data(sku_id);
CREATE INDEX IF NOT EXISTS idx_time_series_date ON time_series_data(date);
CREATE INDEX IF NOT EXISTS idx_time_series_dataset_sku_date ON time_series_data(dataset_id, sku_id, date);

-- Optimization Jobs indexes
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company ON optimization_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_cluster ON optimization_jobs(cluster_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_user ON optimization_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs(sku_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset ON optimization_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_status ON optimization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_batch ON optimization_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_hash ON optimization_jobs(optimization_hash);

-- Optimization Results indexes
CREATE INDEX IF NOT EXISTS idx_optimization_results_company ON optimization_results(company_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_job ON optimization_results(job_id);

-- Models indexes
CREATE INDEX IF NOT EXISTS idx_models_company ON models(company_id);
CREATE INDEX IF NOT EXISTS idx_models_cluster ON models(cluster_id);
CREATE INDEX IF NOT EXISTS idx_models_active ON models(is_active);

-- Forecasts indexes
CREATE INDEX IF NOT EXISTS idx_forecasts_company ON forecasts(company_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_cluster ON forecasts(cluster_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_dataset_sku ON forecasts(dataset_id, sku_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_final ON forecasts(is_final_forecast);
CREATE INDEX IF NOT EXISTS idx_forecasts_hash ON forecasts(forecast_hash);

-- Add a partial unique index for final forecasts per cluster
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_forecast_unique_cluster
ON forecasts (company_id, cluster_id, dataset_id, sku_id)
WHERE is_final_forecast;

-- =====================================================
-- 12. TRIGGERS & FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

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
DECLARE
    user_id_val INTEGER;
BEGIN
    -- Determine user_id based on table structure
    IF TG_OP = 'INSERT' THEN
        -- For datasets table, use uploaded_by instead of created_by
        IF TG_TABLE_NAME = 'datasets' THEN
            user_id_val := NEW.uploaded_by;
        ELSE
            user_id_val := NEW.created_by;
        END IF;
        
        INSERT INTO audit_logs (company_id, user_id, action, table_name, record_id, new_values)
        VALUES (NEW.company_id, user_id_val, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
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
-- 13. APPLY TRIGGERS
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
-- 14. INITIAL DATA (OPTIONAL)
-- =====================================================

-- Insert a default company for initial setup
-- Note: created_by will be set to 1 (first user) after user creation
INSERT INTO companies (id, name, description) 
VALUES (1, 'Default Company', 'Default company for initial setup')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- END OF SCHEMA
-- ===================================================== 