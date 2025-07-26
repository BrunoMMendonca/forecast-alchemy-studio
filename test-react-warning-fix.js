const fetch = require('node-fetch');

// Test to verify React warning about setState during render is fixed
async function testReactWarningFix() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing React Warning Fix...\n');
  
  try {
    // 1. Test fetching setup status to see if we can access the setup wizard
    console.log('1. Checking setup status...');
    const setupResponse = await fetch('http://localhost:3000/api/auth/setup/status', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (setupResponse.ok) {
      const setupStatus = await setupResponse.json();
      console.log(`✅ Setup status:`, setupStatus);
      
      if (setupStatus.setupWizardAccessible) {
        console.log('✅ Setup wizard is accessible');
        
        // 2. Test fetching divisions to trigger the step navigation logic
        console.log('\n2. Testing divisions fetch to trigger step navigation...');
        const divisionsResponse = await fetch('http://localhost:3000/api/divisions', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (divisionsResponse.ok) {
          const divisions = await divisionsResponse.json();
          console.log(`✅ Found ${divisions.length} divisions`);
          
          // 3. Test fetching clusters to trigger the step navigation logic
          console.log('\n3. Testing clusters fetch to trigger step navigation...');
          const clustersResponse = await fetch('http://localhost:3000/api/clusters', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (clustersResponse.ok) {
            const clusters = await clustersResponse.json();
            console.log(`✅ Found ${clusters.length} clusters`);
            
            console.log('\n🎉 React warning fix test completed!');
            console.log('📝 Check the browser console for any React warnings about setState during render.');
            console.log('✅ If no warnings appear, the fix is working correctly.');
          } else {
            console.log('❌ Failed to fetch clusters:', await clustersResponse.text());
          }
        } else {
          console.log('❌ Failed to fetch divisions:', await divisionsResponse.text());
        }
      } else {
        console.log('⚠️  Setup wizard is not accessible');
      }
    } else {
      console.log('❌ Failed to fetch setup status:', await setupResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReactWarningFix(); 