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
 * Get optimization status
 * @route GET /optimizations/status
 * @returns {object} Optimization status and progress grouped by SKU
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
      console.log('Database tables not initialized yet, returning empty optimization status');
      return res.json({ optimizations: [] });
    }

    // Get all optimization jobs for the user and company
    const result = await pgPool.query(`
      SELECT 
        oj.id,
        oj.optimization_id,
        oj.sku_code as sku,
        oj.method,
        oj.status,
        oj.reason,
        oj.created_at,
        oj.updated_at,
        oj.progress,
        oj.dataset_id,
        oj.batch_id,
        oj.company_id,
        oj.user_id
      FROM optimization_jobs oj
      WHERE oj.user_id = $1 AND oj.company_id = $2
      ORDER BY oj.created_at DESC
    `, [userId, companyId]);

    const optimizationJobs = result.rows;

    // Group by SKU and batch
    const skuGroups = {};
    
    optimizationJobs.forEach(job => {
      const sku = job.sku;
      const batchId = job.batch_id || 'default';
      
      if (!skuGroups[sku]) {
        skuGroups[sku] = {
          sku: sku,
          skuDescription: `SKU: ${sku}`,
          datasetId: job.dataset_id,
          batches: {},
          totalJobs: 0,
          pendingJobs: 0,
          runningJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          cancelledJobs: 0,
          skippedJobs: 0,
          progress: 0,
          isOptimizing: false,
          methods: [],
          models: []
        };
      }
      
      if (!skuGroups[sku].batches[batchId]) {
        skuGroups[sku].batches[batchId] = {
          batchId: batchId,
          batchTimestamp: new Date(job.created_at).getTime(),
          sku: sku,
          skuDescription: `SKU: ${sku}`,
          datasetId: job.dataset_id,
          reason: job.reason,
          priority: 1,
          createdAt: job.created_at,
          optimizations: {},
          totalJobs: 0,
          pendingJobs: 0,
          runningJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          cancelledJobs: 0,
          skippedJobs: 0,
          progress: 0,
          isOptimizing: false,
          methods: [],
          models: []
        };
      }
      
      // Add optimization to batch
      const optimizationKey = `${job.method}_${job.optimization_id}`;
      skuGroups[sku].batches[batchId].optimizations[optimizationKey] = {
        optimizationId: job.optimization_id,
        modelId: job.method, // Using method as modelId for now
        modelDisplayName: job.method, // You might want to map this to a display name
        modelShortName: job.method,
        method: job.method,
        methodDisplayName: job.method, // You might want to map this to a display name
        methodShortName: job.method,
        reason: job.reason,
        status: job.status,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        progress: job.progress || 0,
        jobs: [job]
      };
      
      // Update batch counts
      skuGroups[sku].batches[batchId].totalJobs++;
      skuGroups[sku].totalJobs++;
      
      if (job.status === 'pending') {
        skuGroups[sku].batches[batchId].pendingJobs++;
        skuGroups[sku].pendingJobs++;
      } else if (job.status === 'running') {
        skuGroups[sku].batches[batchId].runningJobs++;
        skuGroups[sku].runningJobs++;
      } else if (job.status === 'completed') {
        skuGroups[sku].batches[batchId].completedJobs++;
        skuGroups[sku].completedJobs++;
      } else if (job.status === 'failed') {
        skuGroups[sku].batches[batchId].failedJobs++;
        skuGroups[sku].failedJobs++;
      } else if (job.status === 'cancelled') {
        skuGroups[sku].batches[batchId].cancelledJobs++;
        skuGroups[sku].cancelledJobs++;
      } else if (job.status === 'skipped') {
        skuGroups[sku].batches[batchId].skippedJobs++;
        skuGroups[sku].skippedJobs++;
      }
      
      // Add unique methods and models
      if (!skuGroups[sku].batches[batchId].methods.includes(job.method)) {
        skuGroups[sku].batches[batchId].methods.push(job.method);
      }
      if (!skuGroups[sku].batches[batchId].models.includes(job.method)) {
        skuGroups[sku].batches[batchId].models.push(job.method);
      }
      if (!skuGroups[sku].methods.includes(job.method)) {
        skuGroups[sku].methods.push(job.method);
      }
      if (!skuGroups[sku].models.includes(job.method)) {
        skuGroups[sku].models.push(job.method);
      }
    });
    
    // Calculate progress and optimization status for each batch and SKU
    Object.values(skuGroups).forEach(skuGroup => {
      Object.values(skuGroup.batches).forEach(batch => {
        const total = batch.totalJobs;
        const completed = batch.completedJobs;
        batch.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        batch.isOptimizing = batch.pendingJobs > 0 || batch.runningJobs > 0;
      });
      
      const total = skuGroup.totalJobs;
      const completed = skuGroup.completedJobs;
      skuGroup.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      skuGroup.isOptimizing = skuGroup.pendingJobs > 0 || skuGroup.runningJobs > 0;
    });

    res.json({ optimizations: Object.values(skuGroups) });
    
  } catch (err) {
    console.error('Error fetching optimization status:', err);
    res.status(500).json({ error: 'Failed to fetch optimization status' });
  }
});

/**
 * Cancel optimization
 * @route POST /optimizations/:optimizationId/cancel
 */
router.post('/:optimizationId/cancel', authenticateToken, async (req, res) => {
  try {
    const { optimizationId } = req.params;
    const userId = req.user.id;

    if (!optimizationId) {
      return res.status(400).json({ error: 'Optimization ID is required' });
    }

    const result = await pgPool.query(`
      UPDATE optimization_jobs 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE optimization_id = $1 AND user_id = $2 AND status IN ('pending', 'running')
    `, [optimizationId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No running or pending optimizations found to cancel' });
    }

    res.json({ 
      success: true, 
      message: `Cancelled ${result.rowCount} optimization job(s)` 
    });

  } catch (err) {
    console.error('Error cancelling optimization:', err);
    res.status(500).json({ error: 'Failed to cancel optimization' });
  }
});

/**
 * Pause optimization
 * @route POST /optimizations/:optimizationId/pause
 */
router.post('/:optimizationId/pause', authenticateToken, async (req, res) => {
  try {
    const { optimizationId } = req.params;
    const userId = req.user.id;

    if (!optimizationId) {
      return res.status(400).json({ error: 'Optimization ID is required' });
    }

    const result = await pgPool.query(`
      UPDATE optimization_jobs 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
      WHERE optimization_id = $1 AND user_id = $2 AND status = 'running'
    `, [optimizationId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No running optimizations found to pause' });
    }

    res.json({ 
      success: true, 
      message: `Paused ${result.rowCount} optimization job(s)` 
    });

  } catch (err) {
    console.error('Error pausing optimization:', err);
    res.status(500).json({ error: 'Failed to pause optimization' });
  }
});

/**
 * Get optimization results by hash
 * @route GET /optimization-results/:hash
 */
router.get('/results/:hash', authenticateToken, async (req, res) => {
  try {
    const { hash } = req.params;
    const companyId = req.user.company_id;

    if (!hash) {
      return res.status(400).json({ error: 'Hash is required' });
    }

    const result = await pgPool.query(`
      SELECT * FROM optimization_results 
      WHERE hash = $1 AND company_id = $2
    `, [hash, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization results not found' });
    }

    res.json({ results: result.rows });

  } catch (err) {
    console.error('Error fetching optimization results:', err);
    res.status(500).json({ error: 'Failed to fetch optimization results' });
  }
});

/**
 * Store optimization results
 * @route POST /optimization-results/store
 */
router.post('/results/store', authenticateToken, async (req, res) => {
  try {
    const { hash, modelId, method, parameters, scores, forecasts, companyId } = req.body;

    if (!hash || !modelId || !method || !scores || !forecasts || !companyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pgPool.query(`
      INSERT INTO optimization_results (hash, model_id, method, parameters, scores, forecasts, company_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (hash, model_id, method) 
      DO UPDATE SET 
        parameters = EXCLUDED.parameters,
        scores = EXCLUDED.scores,
        forecasts = EXCLUDED.forecasts,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [hash, modelId, method, JSON.stringify(parameters), JSON.stringify(scores), JSON.stringify(forecasts), companyId]);

    res.json({ 
      success: true, 
      id: result.rows[0].id,
      message: 'Optimization results stored successfully' 
    });

  } catch (err) {
    console.error('Error storing optimization results:', err);
    res.status(500).json({ error: 'Failed to store optimization results' });
  }
});

export default router; 