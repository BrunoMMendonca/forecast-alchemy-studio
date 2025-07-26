-- PostgreSQL schema for Forecast Alchemy Studio
-- Companies (Organizations)
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
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users (multi-role, multi-company)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT ARRAY['viewer'],
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- S&OP Cycles
CREATE TABLE IF NOT EXISTS sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Datasets
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    sop_cycle_id INTEGER REFERENCES sop_cycles(id),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    dataset_hash TEXT,
    metadata JSONB,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    uploaded_by INTEGER REFERENCES users(id)
);

-- Time Series Data (the actual imported data) - reordered with company_id first
CREATE TABLE IF NOT EXISTS time_series_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL,
    date DATE NOT NULL,
    value REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(dataset_id, sku_code, date)
);

-- SKUs
CREATE TABLE IF NOT EXISTS skus (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, sku_code)
);

-- Dataset-SKU relationships
CREATE TABLE IF NOT EXISTS dataset_skus (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
    sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(dataset_id, sku_id)
);

-- Optimization Jobs (job metadata and status tracking)
CREATE TABLE IF NOT EXISTS optimization_jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    sku_id INTEGER REFERENCES skus(id),
    sku TEXT, -- Actual SKU code (e.g., 95000000) for easier querying
    dataset_id INTEGER REFERENCES datasets(id),
    dataset_identifier VARCHAR(255), -- Dataset identifier in format dataset_XX
    method TEXT,
    payload JSONB,
    reason TEXT,
    batch_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
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

-- Optimized Models (if needed)
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parameters JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- Forecasts (removed accuracy field)
CREATE TABLE IF NOT EXISTS forecasts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    sop_cycle_id INTEGER REFERENCES sop_cycles(id),
    dataset_id INTEGER REFERENCES datasets(id),
    sku_id INTEGER REFERENCES skus(id),
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

-- Add a partial unique index for final forecasts
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_forecast_unique
ON forecasts (company_id, dataset_id, sku_id)
WHERE is_final_forecast;

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, key)
);

-- User Settings (renamed from settings)
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, user_id, key)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Aggregatable Field Definitions (per company)
CREATE TABLE IF NOT EXISTS aggregatable_field_defs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    options JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, field_name)
);

-- SKU Aggregatable Field Values (current)
CREATE TABLE IF NOT EXISTS sku_aggregatable_values (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
    field_def_id INTEGER REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(sku_id, field_def_id)
);

-- SKU Aggregatable Field Value History (reordered with company_id first)
CREATE TABLE IF NOT EXISTS sku_aggregatable_value_history (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
    field_def_id INTEGER REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    value TEXT,
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id)
);

-- Dataset Aggregatable Field Mapping (optional, for mapping dataset columns to company fields)
CREATE TABLE IF NOT EXISTS dataset_aggregatable_field_map (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
    field_def_id INTEGER REFERENCES aggregatable_field_defs(id) ON DELETE CASCADE,
    dataset_column TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- Trend Lines
CREATE TABLE IF NOT EXISTS trend_lines (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
    sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
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

-- SOP Aggregator (new table)
CREATE TABLE IF NOT EXISTS sop_aggregator (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    sop_cycle_id INTEGER REFERENCES sop_cycles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(company_size);

-- Optimization Jobs indexes
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_company_status ON optimization_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_sku ON optimization_jobs(sku);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset ON optimization_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_dataset_identifier ON optimization_jobs(dataset_identifier);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_batch_id ON optimization_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_optimization_id ON optimization_jobs(optimization_id);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_optimization_hash ON optimization_jobs(optimization_hash);

-- Optimization Results indexes
CREATE INDEX IF NOT EXISTS idx_optimization_results_company_id ON optimization_results(company_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_company_job ON optimization_results(company_id, job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_job_id ON optimization_results(job_id);
CREATE INDEX IF NOT EXISTS idx_optimization_results_created_at ON optimization_results(created_at);

-- Datasets indexes
CREATE INDEX IF NOT EXISTS idx_datasets_company ON datasets(company_id);
CREATE INDEX IF NOT EXISTS idx_datasets_sop_cycle ON datasets(sop_cycle_id);

-- SKUs indexes
CREATE INDEX IF NOT EXISTS idx_skus_company ON skus(company_id);

-- Forecasts indexes
CREATE INDEX IF NOT EXISTS idx_forecasts_company ON forecasts(company_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_company_dataset_sku ON forecasts (company_id, dataset_id, sku_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_final ON forecasts (is_final_forecast, company_id, sku_id);

-- Time Series Data indexes
CREATE INDEX IF NOT EXISTS idx_time_series_data_company ON time_series_data(company_id);
CREATE INDEX IF NOT EXISTS idx_time_series_dataset_sku ON time_series_data (dataset_id, sku_code);
CREATE INDEX IF NOT EXISTS idx_time_series_date ON time_series_data (date);
CREATE INDEX IF NOT EXISTS idx_time_series_dataset_date ON time_series_data (dataset_id, date);

-- SKU Aggregatable Values indexes
CREATE INDEX IF NOT EXISTS idx_sku_aggval_sku ON sku_aggregatable_values (sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_aggval_field ON sku_aggregatable_values (field_def_id);

-- User Settings indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_company_user ON user_settings(company_id, user_id);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to optimization_results
CREATE TRIGGER update_optimization_results_updated_at 
    BEFORE UPDATE ON optimization_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to optimization_jobs
CREATE TRIGGER update_optimization_jobs_updated_at 
    BEFORE UPDATE ON optimization_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 