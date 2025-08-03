import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../auth.js';

const router = express.Router();

// Database configuration
const pgPool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

/**
 * Get jobs status
 * @route GET /jobs/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!userId || !companyId) {
      return res.status(400).json({ error: 'User ID and company ID are required' });
    }

    // Check if optimization_jobs table exists
    const tableCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Database tables not initialized yet, returning empty job status');
      return res.json({ 
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        skipped: 0,
        isOptimizing: false,
        progress: 0
      });
    }

    // Get job counts by status
    const result = await pgPool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM optimization_jobs 
      WHERE user_id = $1 AND company_id = $2
      GROUP BY status
    `, [userId, companyId]);

    const statusCounts = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0
    };

    result.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
      statusCounts.total += parseInt(row.count);
    });

    const isOptimizing = statusCounts.pending > 0 || statusCounts.running > 0;
    const progress = statusCounts.total > 0 
      ? Math.round(((statusCounts.completed + statusCounts.failed + statusCounts.cancelled + statusCounts.skipped) / statusCounts.total) * 100)
      : 0;

    res.json({
      ...statusCounts,
      isOptimizing,
      progress
    });

  } catch (err) {
    console.error('Error fetching job status:', err);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

/**
 * Get best results per model
 * @route GET /jobs/best-results-per-model
 */
router.get('/best-results-per-model', authenticateToken, async (req, res) => {
  try {
    const { sku, datasetId, modelId, method } = req.query;
    const companyId = req.user.company_id;

    if (!sku || !datasetId) {
      return res.status(400).json({ error: 'SKU and dataset ID are required' });
    }

    // Check if optimization_results table exists
    const tableCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_results'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Database tables not initialized yet, returning empty results');
      return res.json({ results: [] });
    }

    let query = `
      SELECT * FROM optimization_results 
      WHERE company_id = $1 AND hash LIKE $2
    `;
    const params = [companyId, `%${sku}%`];

    if (modelId) {
      query += ` AND method = $${params.length + 1}`;
      params.push(modelId);
    }

    if (method) {
      query += ` AND method = $${params.length + 1}`;
      params.push(method);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pgPool.query(query, params);

    res.json({ results: result.rows });

  } catch (err) {
    console.error('Error fetching best results per model:', err);
    res.status(500).json({ error: 'Failed to fetch best results per model' });
  }
});

/**
 * Get jobs for a specific SKU
 * @route GET /jobs
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { sku, datasetId, modelId, method, status } = req.query;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!userId || !companyId) {
      return res.status(400).json({ error: 'User ID and company ID are required' });
    }

    // Check if optimization_jobs table exists
    const tableCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'optimization_jobs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Database tables not initialized yet, returning empty jobs');
      return res.json({ jobs: [] });
    }

    let query = `
      SELECT * FROM optimization_jobs 
      WHERE user_id = $1 AND company_id = $2
    `;
    const params = [userId, companyId];

    if (sku) {
      query += ` AND sku_code = $${params.length + 1}`;
      params.push(sku);
    }

    if (datasetId) {
      query += ` AND dataset_id = $${params.length + 1}`;
      params.push(datasetId);
    }

    if (modelId) {
      query += ` AND method = $${params.length + 1}`;
      params.push(modelId);
    }

    if (method) {
      query += ` AND method = $${params.length + 1}`;
      params.push(method);
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pgPool.query(query, params);

    res.json({ jobs: result.rows });

  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * Create a new job
 * @route POST /jobs
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { sku, modelId, method, datasetId, reason, parameters } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    if (!sku || !method || !datasetId) {
      return res.status(400).json({ error: 'SKU, method, and dataset ID are required' });
    }

    const result = await pgPool.query(`
      INSERT INTO optimization_jobs (
        sku_code, method, dataset_id, reason, payload, 
        user_id, company_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, optimization_id
    `, [sku, method, datasetId, reason || null, JSON.stringify(parameters || {}), userId, companyId]);

    res.json({ 
      success: true, 
      jobId: result.rows[0].id,
      optimizationId: result.rows[0].optimization_id,
      message: 'Job created successfully' 
    });

  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

export default router; 