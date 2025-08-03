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
 * Get models data requirements
 * @route GET /models/data-requirements
 */
router.get('/data-requirements', authenticateToken, async (req, res) => {
  try {
    // Return model data requirements
    const requirements = {
      'moving_average': {
        minObservations: 3,
        description: 'Requires at least 3 data points'
      },
      'simple_exponential_smoothing': {
        minObservations: 3,
        description: 'Requires at least 3 data points'
      },
      'double_exponential_smoothing': {
        minObservations: 4,
        description: 'Requires at least 4 data points'
      },
      'exponential_smoothing': {
        minObservations: 3,
        description: 'Requires at least 3 data points'
      },
      'linear_trend': {
        minObservations: 3,
        description: 'Requires at least 3 data points'
      },
      'seasonal_moving_average': {
        minObservations: 12,
        description: 'Requires at least 2 full seasons (12 data points for monthly data)'
      },
      'holt_winters': {
        minObservations: 12,
        description: 'Requires at least 2 full seasons (12 data points for monthly data)'
      },
      'seasonal_naive': {
        minObservations: 12,
        description: 'Requires at least 2 full seasons (12 data points for monthly data)'
      }
    };

    res.json(requirements);

  } catch (err) {
    console.error('Error fetching model data requirements:', err);
    res.status(500).json({ error: 'Failed to fetch model data requirements' });
  }
});

/**
 * Check model compatibility
 * @route POST /models/check-compatibility
 */
router.post('/check-compatibility', authenticateToken, async (req, res) => {
  try {
    const { modelId, dataLength, frequency } = req.body;

    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }

    // Get model requirements
    const requirements = {
      'moving_average': { minObservations: 3 },
      'simple_exponential_smoothing': { minObservations: 3 },
      'double_exponential_smoothing': { minObservations: 4 },
      'exponential_smoothing': { minObservations: 3 },
      'linear_trend': { minObservations: 3 },
      'seasonal_moving_average': { minObservations: 12 },
      'holt_winters': { minObservations: 12 },
      'seasonal_naive': { minObservations: 12 }
    };

    const modelRequirement = requirements[modelId];
    if (!modelRequirement) {
      return res.status(400).json({ error: 'Unknown model ID' });
    }

    const isCompatible = dataLength >= modelRequirement.minObservations;
    const seasonalModels = ['seasonal_moving_average', 'holt_winters', 'seasonal_naive'];
    const isSeasonal = seasonalModels.includes(modelId);

    res.json({
      modelId,
      isCompatible,
      isSeasonal,
      minObservations: modelRequirement.minObservations,
      currentObservations: dataLength,
      message: isCompatible 
        ? 'Model is compatible with your data' 
        : `Model requires at least ${modelRequirement.minObservations} observations, but you have ${dataLength}`
    });

  } catch (err) {
    console.error('Error checking model compatibility:', err);
    res.status(500).json({ error: 'Failed to check model compatibility' });
  }
});

/**
 * Get available models
 * @route GET /models
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Return available models
    const models = [
      {
        id: 'moving_average',
        name: 'Moving Average',
        description: 'Simple moving average forecasting',
        category: 'Statistical',
        isSeasonal: false
      },
      {
        id: 'simple_exponential_smoothing',
        name: 'Simple Exponential Smoothing',
        description: 'Exponential smoothing for trendless data',
        category: 'Statistical',
        isSeasonal: false
      },
      {
        id: 'double_exponential_smoothing',
        name: 'Double Exponential Smoothing',
        description: 'Exponential smoothing with trend',
        category: 'Statistical',
        isSeasonal: false
      },
      {
        id: 'exponential_smoothing',
        name: 'Exponential Smoothing',
        description: 'Simple exponential smoothing (alias)',
        category: 'Statistical',
        isSeasonal: false
      },
      {
        id: 'linear_trend',
        name: 'Linear Trend',
        description: 'Linear trend forecasting',
        category: 'Statistical',
        isSeasonal: false
      },
      {
        id: 'seasonal_moving_average',
        name: 'Seasonal Moving Average',
        description: 'Moving average with seasonal adjustment',
        category: 'Seasonal',
        isSeasonal: true
      },
      {
        id: 'holt_winters',
        name: 'Holt-Winters',
        description: 'Triple exponential smoothing with seasonality',
        category: 'Seasonal',
        isSeasonal: true
      },
      {
        id: 'seasonal_naive',
        name: 'Seasonal Naive',
        description: 'Naive forecasting with seasonal patterns',
        category: 'Seasonal',
        isSeasonal: true
      }
    ];

    res.json({ models });

  } catch (err) {
    console.error('Error fetching models:', err);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

export default router; 