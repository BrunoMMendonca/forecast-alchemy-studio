import axios from 'axios';

const BASE_URL = 'http://192.168.1.66:8081/api';

const testBasicEndpoints = async () => {
  console.log('🧪 Testing basic endpoints...\n');

  const basicTests = [
    {
      name: 'GET /health',
      method: 'get',
      url: '/health'
    },
    {
      name: 'GET /schema',
      method: 'get',
      url: '/schema'
    },
    {
      name: 'GET /settings',
      method: 'get',
      url: '/settings'
    },
    {
      name: 'GET /models',
      method: 'get',
      url: '/models'
    }
  ];

  for (const test of basicTests) {
    try {
      console.log(`Testing ${test.name}...`);
      
      const response = await axios({
        method: test.method,
        url: `${BASE_URL}${test.url}`,
        timeout: 5000
      });
      
      console.log(`✅ ${test.name} - PASSED (${response.status})`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.error || error.message}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    console.log('');
  }
};

setTimeout(() => {
  testBasicEndpoints().catch(console.error);
}, 2000); 