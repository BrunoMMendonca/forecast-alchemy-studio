// =====================================================
// UTILITY FUNCTIONS FOR SEPARATED OPTIMIZATION TABLES
// =====================================================

import { pgPool } from './db.js';

/**
 * Store optimization results in the new separated table structure
 * @param {number} jobId - The optimization job ID
 * @param {object} results - The optimization results
 * @returns {Promise<void>}
 */
export async function storeOptimizationResults(jobId, results) {
  try {
    // Get the job to get company_id
    const jobResult = await pgPool.query(
      'SELECT company_id FROM optimization_jobs WHERE id = $1',
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }

    const companyId = jobResult.rows[0].company_id;

    // Extract and structure the results
    const resultData = {
      parameters: results.results?.map(r => r.parameters).filter(Boolean) || [],
      scores: results.results?.map(r => ({ 
        modelType: r.modelType, 
        accuracy: r.accuracy, 
        rmse: r.rmse, 
        mape: r.mape,
        mae: r.mae
      })).filter(Boolean) || [],
      forecasts: results.results?.map(r => r.forecast).filter(Boolean) || []
    };

    // Insert into optimization_results table
    await pgPool.query(
      'INSERT INTO optimization_results (job_id, company_id, parameters, scores, forecasts) VALUES ($1, $2, $3, $4, $5)',
      [jobId, companyId, JSON.stringify(resultData.parameters), JSON.stringify(resultData.scores), JSON.stringify(resultData.forecasts)]
    );

    console.log(`[Utility] Stored optimization results for job ${jobId}`);
  } catch (error) {
    console.error(`[Utility] Failed to store optimization results for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get optimization results for a job
 * @param {number} jobId - The optimization job ID
 * @param {number} companyId - The company ID for security
 * @returns {Promise<object|null>}
 */
export async function getOptimizationResults(jobId, companyId) {
  try {
    const result = await pgPool.query(
      'SELECT parameters, scores, forecasts FROM optimization_results WHERE job_id = $1 AND company_id = $2',
      [jobId, companyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      parameters: row.parameters || [],
      scores: row.scores || [],
      forecasts: row.forecasts || []
    };
  } catch (error) {
    console.error(`[Utility] Failed to get optimization results for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get job with results (combined query)
 * @param {number} jobId - The optimization job ID
 * @param {number} companyId - The company ID for security
 * @returns {Promise<object|null>}
 */
export async function getJobWithResults(jobId, companyId) {
  try {
    const result = await pgPool.query(
      `SELECT oj.*, ores.parameters, ores.scores, ores.forecasts 
       FROM optimization_jobs oj 
       LEFT JOIN optimization_results ores ON oj.id = ores.job_id AND ores.company_id = oj.company_id
       WHERE oj.id = $1 AND oj.company_id = $2`,
      [jobId, companyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(`[Utility] Failed to get job with results for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get jobs with results for a dataset
 * @param {number} companyId - The company ID
 * @param {number} datasetId - The dataset ID
 * @param {string} method - Optional method filter
 * @returns {Promise<Array>}
 */
export async function getJobsWithResults(companyId, datasetId, method = null) {
  try {
    let query = `SELECT oj.*, ores.parameters, ores.scores, ores.forecasts 
                  FROM optimization_jobs oj 
                  LEFT JOIN optimization_results ores ON oj.id = ores.job_id AND ores.company_id = oj.company_id
                  WHERE oj.company_id = $1 AND oj.dataset_id = $2`;
    let params = [companyId, datasetId];

    if (method && method !== 'all') {
      query += ' AND oj.method = $3';
      params.push(method);
    }

    query += ' ORDER BY oj.created_at DESC';

    const result = await pgPool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(`[Utility] Failed to get jobs with results for dataset ${datasetId}:`, error);
    throw error;
  }
}
