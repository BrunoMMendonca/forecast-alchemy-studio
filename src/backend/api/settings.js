import express from 'express';
import { authenticateToken } from '../auth.js';
import { pgPool } from '../db.js';

const router = express.Router();

// GET /api/settings - Get user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    
    // Get user's settings from database using key-value structure
    const settingsQuery = `
      SELECT key, value
      FROM user_settings 
      WHERE user_id = $1 AND company_id = $2
    `;
    
    const settingsResult = await pgPool.query(settingsQuery, [userId, companyId]);
    
    // Convert key-value pairs to settings object
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({
      global_frequency: settings.global_frequency || 'monthly',
      global_autoDetectFrequency: settings.global_autoDetectFrequency !== undefined ? settings.global_autoDetectFrequency : true,
      global_csvSeparator: settings.global_csvSeparator || ',',
      global_seasonalPeriods: settings.global_seasonalPeriods || 12
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/settings - Save user settings
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const { frequency, autoDetectFrequency, csvSeparator, seasonalPeriods } = req.body;
    
    // Save each setting as a key-value pair
    const settings = [
      { key: 'global_frequency', value: frequency || 'monthly' },
      { key: 'global_autoDetectFrequency', value: autoDetectFrequency !== undefined ? autoDetectFrequency : true },
      { key: 'global_csvSeparator', value: csvSeparator || ',' },
      { key: 'global_seasonalPeriods', value: seasonalPeriods || 12 }
    ];
    
    // Upsert each setting
    for (const setting of settings) {
      const upsertQuery = `
        INSERT INTO user_settings (company_id, user_id, key, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (company_id, user_id, key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await pgPool.query(upsertQuery, [
        companyId,
        userId,
        setting.key,
        setting.value
      ]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router; 