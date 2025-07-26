import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: 'postgresql://postgres:password@localhost:5432/forecast_alchemy'
});

async function checkSetupValues() {
  try {
    console.log('🔍 Checking setup values in database...\n');

    // Check company setup values
    const companyResult = await pgPool.query(
      'SELECT id, name, setup_completed, setup_wizard_accessible FROM companies WHERE id = 1'
    );

    if (companyResult.rows.length === 0) {
      console.log('❌ No company found with id = 1');
      return;
    }

    const company = companyResult.rows[0];
    console.log('📊 Company Setup Values:');
    console.log(`  - Company ID: ${company.id}`);
    console.log(`  - Company Name: ${company.name}`);
    console.log(`  - setup_completed: ${company.setup_completed}`);
    console.log(`  - setup_wizard_accessible: ${company.setup_wizard_accessible}`);

    // Check divisions and clusters
    const divisionsResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM divisions WHERE company_id = 1'
    );
    
    const clustersResult = await pgPool.query(
      'SELECT COUNT(*) as count FROM clusters WHERE company_id = 1'
    );

    console.log('\n📈 Setup Progress:');
    console.log(`  - Divisions: ${divisionsResult.rows[0].count}`);
    console.log(`  - Clusters: ${clustersResult.rows[0].count}`);

    // Calculate what should happen
    const setupRequired = !company.setup_completed;
    const canAccessWizard = company.setup_wizard_accessible;

    console.log('\n🎯 Expected Behavior:');
    console.log(`  - Setup Required: ${setupRequired}`);
    console.log(`  - Can Access Wizard: ${canAccessWizard}`);

    if (setupRequired && canAccessWizard) {
      console.log('✅ User should be able to access setup wizard');
    } else if (!setupRequired && canAccessWizard) {
      console.log('✅ User should be able to access setup wizard (for modifications)');
    } else if (!setupRequired && !canAccessWizard) {
      console.log('❌ User cannot access setup wizard (setup complete, access disabled)');
    } else {
      console.log('❌ User cannot access setup wizard (setup required, access disabled)');
    }

  } catch (error) {
    console.error('❌ Error checking setup values:', error);
  } finally {
    await pgPool.end();
  }
}

checkSetupValues(); 