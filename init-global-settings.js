import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'forecast_alchemy',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initializeGlobalSettings() {
  try {
    console.log('Initializing default global settings...');
    
    // Test database connection first
    const testResult = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful');
    
    const defaultSettings = [
      // Core forecast settings
      { key: 'global_forecastPeriods', value: '12', description: 'Number of periods to forecast into the future' },
      
      // Business context settings
      { key: 'business_costOfError', value: 'medium', description: 'Cost of forecast errors (low, medium, high)' },
      { key: 'business_planningPurpose', value: 'tactical', description: 'Planning purpose (operational, tactical, strategic)' },
      { key: 'business_updateFrequency', value: 'weekly', description: 'Model update frequency (daily, weekly, monthly)' },
      { key: 'business_interpretabilityNeeds', value: 'medium', description: 'Interpretability needs (low, medium, high)' },
      
      // AI settings
      { key: 'global_aiForecastModelOptimizationEnabled', value: 'false', description: 'Enable AI-powered model optimization' },
      { key: 'global_aiCsvImportEnabled', value: 'true', description: 'Enable AI-powered CSV import assistance' },
      { key: 'global_aiFailureThreshold', value: '5', description: 'Number of failures before AI optimization stops' },
      { key: 'global_aiReasoningEnabled', value: 'false', description: 'Enable AI reasoning for model selection' },
      
      // File processing settings
      { key: 'global_largeFileProcessingEnabled', value: 'true', description: 'Enable processing of large files' },
      { key: 'global_largeFileThreshold', value: '1048576', description: 'Large file threshold in bytes (1MB default)' },
      
      // Metric weights (as percentages)
      { key: 'global_mapeWeight', value: '40', description: 'MAPE weight for model evaluation (percentage)' },
      { key: 'global_rmseWeight', value: '30', description: 'RMSE weight for model evaluation (percentage)' },
      { key: 'global_maeWeight', value: '20', description: 'MAE weight for model evaluation (percentage)' },
      { key: 'global_accuracyWeight', value: '10', description: 'Accuracy weight for model evaluation (percentage)' },
      
      // CSV import settings
      { key: 'global_csvSeparator', value: ',', description: 'Default CSV separator for import/export' },
      { key: 'global_autoDetectFrequency', value: 'true', description: 'Auto-detect data frequency during import' }
    ];

    for (const setting of defaultSettings) {
      await pool.query(`
        INSERT INTO company_settings (company_id, key, value, updated_by) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (company_id, key) 
        DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP, updated_by = $4
      `, [1, setting.key, setting.value, 1]);
      
      console.log(`✅ Initialized setting: ${setting.key} = ${setting.value}`);
    }

    console.log('✅ All default global settings initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing global settings:', error);
  } finally {
    await pool.end();
  }
}

initializeGlobalSettings(); 