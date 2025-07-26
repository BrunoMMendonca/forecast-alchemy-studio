import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

async function runSoftDeleteMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking current database structure...');
    
    // Check current divisions table structure
    const divisionsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'divisions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Current divisions table structure:');
    divisionsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check if soft delete columns exist
    const hasSoftDeleteColumns = divisionsStructure.rows.some(row => 
      ['is_active', 'deleted_at', 'deleted_by'].includes(row.column_name)
    );
    
    if (hasSoftDeleteColumns) {
      console.log('✅ Soft delete columns already exist in divisions table');
    } else {
      console.log('🔧 Adding soft delete columns to divisions table...');
      
      await client.query(`
        ALTER TABLE divisions 
        ADD COLUMN is_active BOOLEAN DEFAULT true,
        ADD COLUMN deleted_at TIMESTAMP,
        ADD COLUMN deleted_by INTEGER
      `);
      
      console.log('✅ Soft delete columns added to divisions table');
    }
    
    // Check current clusters table structure
    const clustersStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'clusters' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Current clusters table structure:');
    clustersStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check if soft delete columns exist in clusters
    const clustersHasSoftDeleteColumns = clustersStructure.rows.some(row => 
      ['is_active', 'deleted_at', 'deleted_by'].includes(row.column_name)
    );
    
    if (clustersHasSoftDeleteColumns) {
      console.log('✅ Soft delete columns already exist in clusters table');
    } else {
      console.log('🔧 Adding soft delete columns to clusters table...');
      
      await client.query(`
        ALTER TABLE clusters 
        ADD COLUMN is_active BOOLEAN DEFAULT true,
        ADD COLUMN deleted_at TIMESTAMP,
        ADD COLUMN deleted_by INTEGER
      `);
      
      console.log('✅ Soft delete columns added to clusters table');
    }
    
    // Create indexes
    console.log('🔧 Creating indexes...');
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_divisions_is_active ON divisions(is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_divisions_deleted_at ON divisions(deleted_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clusters_is_active ON clusters(is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clusters_deleted_at ON clusters(deleted_at)');
    
    console.log('✅ Indexes created');
    
    // Verify final structure
    console.log('🔍 Verifying final structure...');
    
    const finalDivisionsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'divisions' AND column_name IN ('is_active', 'deleted_at', 'deleted_by')
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Soft delete columns in divisions table:');
    finalDivisionsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('🎉 Soft delete migration completed successfully!');
    console.log('🚀 You can now use the soft delete functionality.');
    
  } catch (error) {
    console.error('❌ Error running soft delete migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runSoftDeleteMigration().catch(console.error); 
 
 
 
 
 
 
 
 
 