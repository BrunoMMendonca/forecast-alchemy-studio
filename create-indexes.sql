-- Database Indexes for Forecast Alchemy Studio
-- Run this script in DBeaver to create performance indexes

-- Index for optimization_jobs table on company_id and user_id
CREATE INDEX idx_optimization_jobs_company_user ON optimization_jobs(company_id, user_id);

-- Index for optimization_jobs table on dataset_id
CREATE INDEX idx_optimization_jobs_dataset ON optimization_jobs(dataset_id);

-- Index for skus table on company_id and sku_code
CREATE INDEX idx_skus_company_sku ON skus(company_id, sku_code);

-- Index for models table on company_id and model_name
CREATE INDEX idx_models_company_name ON models(company_id, model_name);

-- Index for forecasts table on company_id and dataset_id
CREATE INDEX idx_forecasts_company_dataset ON forecasts(company_id, dataset_id);

-- Optional: Add comments to document the purpose of each index
COMMENT ON INDEX idx_optimization_jobs_company_user IS 'Improves performance for filtering optimization jobs by company and user';
COMMENT ON INDEX idx_optimization_jobs_dataset IS 'Improves performance for filtering optimization jobs by dataset';
COMMENT ON INDEX idx_skus_company_sku IS 'Improves performance for filtering SKUs by company and SKU code';
COMMENT ON INDEX idx_models_company_name IS 'Improves performance for filtering models by company and model name';
COMMENT ON INDEX idx_forecasts_company_dataset IS 'Improves performance for filtering forecasts by company and dataset'; 