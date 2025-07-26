import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pgPool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// --- DEBUG LOGGING FOR $2 PARAMETER QUERIES ---
function debugQuery(query, params) {
  console.log('[DEBUG SQL]', query.replace(/\s+/g, ' ').trim());
  console.log('[DEBUG PARAMS]', params);
}

// Helper function to create a new dataset (updated for cluster-based)
export async function createDataset(companyId, divisionId, clusterId, name, filePath, createdBy, metadata, sopCycleId = null) {
  const query = `
    INSERT INTO datasets (company_id, division_id, cluster_id, name, file_path, dataset_hash, created_by, metadata, sop_cycle_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;
  const datasetHash = metadata?.csvHash || null;
  const result = await pgPool.query(query, [
    companyId, divisionId, clusterId, name, filePath, datasetHash, createdBy, metadata, sopCycleId
  ]);
  return result.rows[0].id;
}

// Helper function to insert time series data (updated for new schema)
export async function insertTimeSeriesData(datasetId, timeSeriesRows, companyId) {
  if (timeSeriesRows.length === 0) return;
  
  // First, get or create SKUs for all unique SKU codes
  const uniqueSkuCodes = [...new Set(timeSeriesRows.map(row => row.sku_code))];
  const skuMap = new Map();
  
  for (const skuCode of uniqueSkuCodes) {
    const skuId = await getOrCreateSku(companyId, skuCode);
    skuMap.set(skuCode, skuId);
  }
  
  // Prepare batch insert with new schema
  const values = timeSeriesRows.map((row, index) => {
    const baseIndex = index * 6;
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
  }).join(', ');
  
  const query = `
    INSERT INTO time_series_data (company_id, dataset_id, sku_id, sku_code, date, value)
    VALUES ${values}
  `;
  
  const params = timeSeriesRows.flatMap(row => [
    companyId,
    datasetId,
    skuMap.get(row.sku_code),
    row.sku_code,
    row.date,
    row.value
  ]);
  
  await pgPool.query(query, params);
}

// Helper function to get time series data for a dataset and SKU (updated)
export async function getTimeSeriesData(datasetId, skuCode = null) {
  let query = `
    SELECT tsd.sku_code, tsd.date, tsd.value, s.id as sku_id
    FROM time_series_data tsd
    JOIN skus s ON tsd.sku_id = s.id
    WHERE tsd.dataset_id = $1
  `;
  let params = [datasetId];
  
  if (skuCode) {
    query += ' AND tsd.sku_code = $2';
    params.push(skuCode);
    debugQuery(query, params);
  }
  
  query += ' ORDER BY tsd.sku_code, tsd.date';
  
  const result = await pgPool.query(query, params);
  return result.rows;
}

// Helper function to get dataset metadata (updated for new schema)
export async function getDatasetMetadata(datasetId) {
  const query = `
    SELECT d.id, d.name, d.file_path, d.metadata, d.uploaded_at, d.status, d.source_type,
           d.company_id, d.division_id, d.cluster_id, d.sop_cycle_id,
           c.name as company_name,
           div.name as division_name,
           cl.name as cluster_name,
           sc.name as sop_cycle_name
    FROM datasets d
    JOIN companies c ON d.company_id = c.id
    LEFT JOIN divisions div ON d.division_id = div.id
    LEFT JOIN clusters cl ON d.cluster_id = cl.id
    LEFT JOIN sop_cycles sc ON d.sop_cycle_id = sc.id
    WHERE d.id = $1
  `;
  const result = await pgPool.query(query, [datasetId]);
  return result.rows[0];
}

// Helper function to get all datasets for a company (updated for hierarchy)
export async function getDatasets(companyId, divisionId = null, clusterId = null) {
  let query = `
    SELECT d.id, d.name, d.file_path, d.dataset_hash, d.metadata, d.uploaded_at, d.status, d.source_type,
           d.company_id, d.division_id, d.cluster_id, d.sop_cycle_id,
           c.name as company_name,
           div.name as division_name,
           cl.name as cluster_name,
           sc.name as sop_cycle_name
    FROM datasets d
    JOIN companies c ON d.company_id = c.id
    LEFT JOIN divisions div ON d.division_id = div.id
    LEFT JOIN clusters cl ON d.cluster_id = cl.id
    LEFT JOIN sop_cycles sc ON d.sop_cycle_id = sc.id
    WHERE d.company_id = $1
  `;
  let params = [companyId];
  
  if (divisionId) {
    query += ' AND d.division_id = $2';
    params.push(divisionId);
  }
  
  if (clusterId) {
    query += ` AND d.cluster_id = $${params.length + 1}`;
    params.push(clusterId);
  }
  
  query += ' ORDER BY d.uploaded_at DESC';
  
  const result = await pgPool.query(query, params);
  return result.rows;
}

// Helper function to find existing dataset by hash (updated)
export async function findDatasetByHash(companyId, datasetHash, clusterId = null) {
  let query = `
    SELECT d.id, d.name, d.file_path, d.dataset_hash, d.metadata, d.uploaded_at, d.status, d.source_type,
           d.company_id, d.division_id, d.cluster_id, d.sop_cycle_id,
           c.name as company_name,
           div.name as division_name,
           cl.name as cluster_name
    FROM datasets d
    JOIN companies c ON d.company_id = c.id
    LEFT JOIN divisions div ON d.division_id = div.id
    LEFT JOIN clusters cl ON d.cluster_id = cl.id
    WHERE d.company_id = $1 AND d.dataset_hash = $2
  `;
  let params = [companyId, datasetHash];
  
  if (clusterId) {
    query += ' AND d.cluster_id = $3';
    params.push(clusterId);
  }
  
  query += ' ORDER BY d.uploaded_at DESC LIMIT 1';
  
  const result = await pgPool.query(query, params);
  return result.rows[0] || null;
}

// Helper function to get or create SKU (updated for division-based)
export async function getOrCreateSku(companyId, skuCode, divisionId = null) {
  // First try to find existing SKU in any division or without division
  let query = `
    SELECT id, division_id FROM skus 
    WHERE company_id = $1 AND sku_code = $2
  `;
  let params = [companyId, skuCode];
  
  if (divisionId) {
    query += ' AND division_id = $3';
    params.push(divisionId);
  } else {
    query += ' AND division_id IS NULL';
  }
  
  query += ' LIMIT 1';
  
  let skuResult = await pgPool.query(query, params);
  
  if (skuResult.rows.length > 0) {
    return skuResult.rows[0].id;
  }
  
  // If not found, create new SKU
  if (divisionId) {
    // Create SKU with specified division
    const newSkuResult = await pgPool.query(
      'INSERT INTO skus (company_id, division_id, sku_code) VALUES ($1, $2, $3) RETURNING id',
      [companyId, divisionId, skuCode]
    );
    return newSkuResult.rows[0].id;
  } else {
    // Create SKU without division (for companies without divisions)
    const newSkuResult = await pgPool.query(
      'INSERT INTO skus (company_id, sku_code) VALUES ($1, $2) RETURNING id',
      [companyId, skuCode]
    );
    return newSkuResult.rows[0].id;
  }
}

// Helper function to get divisions for a company
export async function getDivisions(companyId) {
  const query = `
    SELECT id, name, description, is_active, created_at
    FROM divisions
    WHERE company_id = $1 AND is_active = true
    ORDER BY name
  `;
  const result = await pgPool.query(query, [companyId]);
  return result.rows;
}

// Helper function to get clusters for a division
export async function getClusters(companyId, divisionId = null) {
  let query = `
    SELECT c.id, c.name, c.description, c.country_code, c.region, c.is_active, c.created_at,
           c.division_id, d.name as division_name
    FROM clusters c
    JOIN divisions d ON c.division_id = d.id
    WHERE c.company_id = $1 AND c.is_active = true
  `;
  let params = [companyId];
  
  if (divisionId) {
    query += ' AND c.division_id = $2';
    params.push(divisionId);
  }
  
  query += ' ORDER BY d.name, c.name';
  
  const result = await pgPool.query(query, params);
  return result.rows;
}

// Helper function to get S&OP cycles for a division
export async function getSopCycles(companyId, divisionId = null) {
  let query = `
    SELECT sc.id, sc.name, sc.description, sc.start_date, sc.end_date, sc.status, sc.is_current, sc.created_at,
           d.name as division_name
    FROM sop_cycles sc
    JOIN divisions d ON sc.division_id = d.id
    WHERE sc.company_id = $1
  `;
  let params = [companyId];
  
  if (divisionId) {
    query += ' AND sc.division_id = $2';
    params.push(divisionId);
  }
  
  query += ' ORDER BY sc.start_date DESC';
  
  const result = await pgPool.query(query, params);
  return result.rows;
}

// Helper function to get user roles and permissions
export async function getUserRoles(userId, companyId) {
  const query = `
    SELECT ur.id, ur.role_type, ur.division_id, ur.cluster_id, ur.is_active,
           d.name as division_name,
           c.name as cluster_name
    FROM user_roles ur
    LEFT JOIN divisions d ON ur.division_id = d.id
    LEFT JOIN clusters c ON ur.cluster_id = c.id
    WHERE ur.user_id = $1 AND ur.company_id = $2 AND ur.is_active = true
    ORDER BY ur.role_type, d.name, c.name
  `;
  const result = await pgPool.query(query, [userId, companyId]);
  return result.rows;
}
