import { Pool } from 'pg';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/forecast_alchemy' 
});

async function initializeSettings() {
  try {
    console.log('Initializing default settings...');
    
    const defaultSettings = [
      { key: 'global_frequency', value: 'monthly', description: 'Data frequency (daily, weekly, monthly, quarterly, yearly)' },
      { key: 'global_seasonalPeriods', value: '12', description: 'Number of periods in each season' },
      { key: 'global_autoDetectFrequency', value: 'true', description: 'Whether to automatically detect frequency from dataset' },
      { key: 'global_csvSeparator', value: ',', description: 'Default CSV separator for import/export' },
      { key: 'global_companyId', value: 'default_company', description: 'Default company identifier' }
    ];

    for (const setting of defaultSettings) {
      await pool.query(`
        INSERT INTO settings (key, value, description, updated_at) 
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, description = $3, updated_at = CURRENT_TIMESTAMP
      `, [setting.key, setting.value, setting.description]);
      
      console.log(`✅ Initialized setting: ${setting.key} = ${setting.value}`);
    }

    console.log('✅ All default settings initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing settings:', error);
  } finally {
    await pool.end();
  }
}

initializeSettings(); 