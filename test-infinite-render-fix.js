const fetch = require('node-fetch');

// Test to verify infinite re-render issue is fixed
async function testInfiniteRenderFix() {
  const sessionToken = 'your-session-token-here'; // Replace with actual token
  
  console.log('🧪 Testing Infinite Re-render Fix...\n');
  
  try {
    // 1. Test fetching setup status
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
        
        // 2. Test fetching divisions multiple times to trigger navigation logic
        console.log('\n2. Testing divisions fetch (multiple times)...');
        for (let i = 0; i < 3; i++) {
          console.log(`   Fetch ${i + 1}/3...`);
          const divisionsResponse = await fetch('http://localhost:3000/api/divisions', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (divisionsResponse.ok) {
            const divisions = await divisionsResponse.json();
            console.log(`   ✅ Found ${divisions.length} divisions`);
          } else {
            console.log(`   ❌ Failed to fetch divisions:`, await divisionsResponse.text());
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 3. Test fetching clusters multiple times to trigger navigation logic
        console.log('\n3. Testing clusters fetch (multiple times)...');
        for (let i = 0; i < 3; i++) {
          console.log(`   Fetch ${i + 1}/3...`);
          const clustersResponse = await fetch('http://localhost:3000/api/clusters', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          
          if (clustersResponse.ok) {
            const clusters = await clustersResponse.json();
            console.log(`   ✅ Found ${clusters.length} clusters`);
          } else {
            console.log(`   ❌ Failed to fetch clusters:`, await clustersResponse.text());
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\n🎉 Infinite re-render fix test completed!');
        console.log('📝 Check the browser console for:');
        console.log('   ✅ No infinite re-render loops');
        console.log('   ✅ No excessive API calls');
        console.log('   ✅ Smooth navigation between steps');
        console.log('   ✅ No React warnings about setState during render');
        
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
testInfiniteRenderFix(); 