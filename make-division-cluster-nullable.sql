-- Migration to make division_id and cluster_id nullable in skus table
-- This allows companies to operate without divisions and clusters

-- Make division_id nullable in skus table
ALTER TABLE skus ALTER COLUMN division_id DROP NOT NULL;

-- Update the unique constraint to handle NULL division_id
DROP INDEX IF EXISTS idx_skus_company_division_sku;
ALTER TABLE skus DROP CONSTRAINT IF EXISTS skus_company_id_division_id_sku_code_key;

-- Create a new unique constraint that allows NULL division_id
CREATE UNIQUE INDEX idx_skus_company_division_sku 
ON skus (company_id, COALESCE(division_id, 0), sku_code);

-- Make cluster_id nullable in datasets table
ALTER TABLE datasets ALTER COLUMN cluster_id DROP NOT NULL;

-- Update the unique constraint in datasets to handle NULL cluster_id
DROP INDEX IF EXISTS idx_datasets_cluster_name;
ALTER TABLE datasets DROP CONSTRAINT IF EXISTS datasets_cluster_id_name_key;

-- Create a new unique constraint that allows NULL cluster_id
CREATE UNIQUE INDEX idx_datasets_cluster_name 
ON datasets (COALESCE(cluster_id, 0), name);

-- Make division_id nullable in datasets table
ALTER TABLE datasets ALTER COLUMN division_id DROP NOT NULL;

-- Update the unique constraint in datasets to handle NULL division_id
CREATE UNIQUE INDEX idx_datasets_division_cluster_name 
ON datasets (COALESCE(division_id, 0), COALESCE(cluster_id, 0), name);

-- Make division_id and cluster_id nullable in optimization_jobs table
ALTER TABLE optimization_jobs ALTER COLUMN division_id DROP NOT NULL;
ALTER TABLE optimization_jobs ALTER COLUMN cluster_id DROP NOT NULL;

-- Make division_id and cluster_id nullable in optimization_results table
ALTER TABLE optimization_results ALTER COLUMN division_id DROP NOT NULL;
ALTER TABLE optimization_results ALTER COLUMN cluster_id DROP NOT NULL;

-- Update the unique constraint in optimization_results to handle NULL cluster_id
DROP INDEX IF EXISTS idx_optimization_results_cluster_hash;
CREATE UNIQUE INDEX idx_optimization_results_cluster_hash 
ON optimization_results (COALESCE(cluster_id, 0), optimization_hash);

-- Make division_id and cluster_id nullable in models table
ALTER TABLE models ALTER COLUMN division_id DROP NOT NULL;
ALTER TABLE models ALTER COLUMN cluster_id DROP NOT NULL;

-- Make division_id and cluster_id nullable in forecasts table
ALTER TABLE forecasts ALTER COLUMN division_id DROP NOT NULL;
ALTER TABLE forecasts ALTER COLUMN cluster_id DROP NOT NULL;

-- Update the unique constraint in forecasts to handle NULL cluster_id
DROP INDEX IF EXISTS idx_final_forecast_unique_cluster;
CREATE UNIQUE INDEX idx_final_forecast_unique_cluster
ON forecasts (COALESCE(cluster_id, 0), dataset_id, sku_id, period_id, method_type)
WHERE is_final_forecast = true;

-- Make division_id and cluster_id nullable in dataset_lineage table
ALTER TABLE dataset_lineage ALTER COLUMN division_id DROP NOT NULL;

-- Add comments to document the changes
COMMENT ON COLUMN skus.division_id IS 'Division ID (nullable - allows companies without divisions)';
COMMENT ON COLUMN datasets.division_id IS 'Division ID (nullable - allows companies without divisions)';
COMMENT ON COLUMN datasets.cluster_id IS 'Cluster ID (nullable - allows companies without clusters)';
COMMENT ON COLUMN optimization_jobs.division_id IS 'Division ID (nullable - allows companies without divisions)';
COMMENT ON COLUMN optimization_jobs.cluster_id IS 'Cluster ID (nullable - allows companies without clusters)';
COMMENT ON COLUMN optimization_results.division_id IS 'Division ID (nullable - allows companies without divisions)';
COMMENT ON COLUMN optimization_results.cluster_id IS 'Cluster ID (nullable - allows companies without clusters)';
COMMENT ON COLUMN models.division_id IS 'Division ID (nullable - allows companies without divisions)';
COMMENT ON COLUMN models.cluster_id IS 'Cluster ID (nullable - allows companies without clusters)';
COMMENT ON COLUMN forecasts.division_id IS 'Division ID (nullable - allows companies without divisions)';
COMMENT ON COLUMN forecasts.cluster_id IS 'Cluster ID (nullable - allows companies without clusters)';
COMMENT ON COLUMN dataset_lineage.division_id IS 'Division ID (nullable - allows companies without divisions)'; 