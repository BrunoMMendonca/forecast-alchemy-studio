import axios from 'axios';

const BASE_URL = 'http://192.168.1.66:8081/api';

const testEndpoints = async () => {
  console.log('🧪 Testing all recovered endpoints...\n');

  const tests = [
    // CSV Import & Data Processing
    {
      name: 'POST /grok-generate-config',
      method: 'post',
      url: '/grok-generate-config',
      data: {
        csvChunk: [
          { 'Material Code': 'SKU001', 'Jan': '100', 'Feb': '120', 'Mar': '110' },
          { 'Material Code': 'SKU002', 'Jan': '80', 'Feb': '90', 'Mar': '85' }
        ],
        fileSize: 1024,
        reasoningEnabled: false
      }
    },
    {
      name: 'POST /apply-config',
      method: 'post',
      url: '/apply-config',
      data: {
        data: [
          { 'Material Code': 'SKU001', 'Jan': '100', 'Feb': '120', 'Mar': '110' }
        ],
        config: {
          operations: [
            { operation: 'pivot_longer', cols: ['Jan', 'Feb', 'Mar'], names_to: 'Month', values_to: 'Sales' }
          ]
        }
      }
    },
    {
      name: 'GET /load-processed-data',
      method: 'get',
      url: '/load-processed-data?fileName=test.csv'
    },
    {
      name: 'POST /ai-optimize',
      method: 'post',
      url: '/ai-optimize',
      data: {
        modelId: 'arima',
        data: [100, 120, 110, 130, 125, 140],
        metricWeights: { mape: 0.5, rmse: 0.5 }
      }
    },
    {
      name: 'POST /ai-model-recommendation',
      method: 'post',
      url: '/ai-model-recommendation',
      data: {
        data: [100, 120, 110, 130, 125, 140]
      }
    },
    {
      name: 'POST /save-cleaned-data',
      method: 'post',
      url: '/save-cleaned-data',
      data: {
        data: [
          { 'Material Code': 'SKU001', 'Date': '2024-01-01', 'Sales': '100' }
        ],
        fileName: 'test-cleaned.csv',
        metadata: { source: 'test' }
      }
    },
    {
      name: 'POST /process-ai-import',
      method: 'post',
      url: '/process-ai-import',
      data: {
        transformedData: [
          { 'Material Code': 'SKU001', 'Date': '2024-01-01', 'Sales': '100' }
        ],
        originalCsvString: 'Material Code,Date,Sales\nSKU001,2024-01-01,100',
        reasoning: 'Test reasoning'
      }
    },
    {
      name: 'GET /load-cleaning-metadata',
      method: 'get',
      url: '/load-cleaning-metadata?fileName=test-cleaned.csv'
    },
    {
      name: 'POST /check-csv-duplicate',
      method: 'post',
      url: '/check-csv-duplicate',
      data: {
        csvString: 'Material Code,Date,Sales\nSKU001,2024-01-01,100'
      }
    },

    // Job Management
    {
      name: 'POST /jobs/reset',
      method: 'post',
      url: '/jobs/reset',
      data: {
        datasetIdentifier: 'dataset_1'
      }
    },
    {
      name: 'POST /jobs/clear-completed',
      method: 'post',
      url: '/jobs/clear-completed',
      data: {
        datasetIdentifier: 'dataset_1'
      }
    },
    {
      name: 'POST /jobs/clear-pending',
      method: 'post',
      url: '/jobs/clear-pending',
      data: {
        datasetIdentifier: 'dataset_1'
      }
    },

    // User Management
    {
      name: 'POST /register',
      method: 'post',
      url: '/register',
      data: {
        username: 'testuser',
        password: 'testpass123',
        email: 'test@example.com'
      }
    },
    {
      name: 'POST /login',
      method: 'post',
      url: '/login',
      data: {
        username: 'testuser',
        password: 'testpass123'
      }
    },

    // Dataset Management
    {
      name: 'DELETE /datasets/999',
      method: 'delete',
      url: '/datasets/999'
    },
    {
      name: 'POST /datasets/1/rename',
      method: 'post',
      url: '/datasets/1/rename',
      data: {
        name: 'Renamed Dataset'
      }
    },

    // Forecast Management
    {
      name: 'GET /api/forecasts',
      method: 'get',
      url: '/api/forecasts?datasetIdentifier=dataset_1'
    },
    {
      name: 'POST /api/forecasts',
      method: 'post',
      url: '/api/forecasts',
      data: {
        datasetIdentifier: 'dataset_1',
        sku: 'SKU001',
        modelId: 'arima',
        method: 'grid',
        periods: 12,
        parameters: { p: 1, d: 1, q: 1 },
        forecasts: [110, 115, 120, 125]
      }
    },
    {
      name: 'POST /api/forecasts/batch',
      method: 'post',
      url: '/api/forecasts/batch',
      data: {
        datasetIdentifier: 'dataset_1',
        forecasts: [
          {
            sku: 'SKU001',
            modelId: 'arima',
            method: 'grid',
            periods: 12,
            parameters: { p: 1, d: 1, q: 1 },
            forecasts: [110, 115, 120, 125]
          }
        ]
      }
    },

    // Settings
    {
      name: 'POST /settings/initialize',
      method: 'post',
      url: '/settings/initialize'
    },

    // Dataset Frequency
    {
      name: 'POST /dataset/1/auto-detect-frequency',
      method: 'post',
      url: '/dataset/1/auto-detect-frequency'
    },

    // Model Management
    {
      name: 'POST /models/check-compatibility',
      method: 'post',
      url: '/models/check-compatibility',
      data: {
        datasetIdentifier: 'dataset_1',
        modelId: 'arima'
      }
    },
    {
      name: 'GET /models/data-requirements',
      method: 'get',
      url: '/models/data-requirements'
    },

    // Jobs Results
    {
      name: 'GET /jobs/results-summary',
      method: 'get',
      url: '/jobs/results-summary?datasetIdentifier=dataset_1'
    },
    {
      name: 'GET /jobs/export-results',
      method: 'get',
      url: '/jobs/export-results?datasetIdentifier=dataset_1&format=json'
    },

    // Forecast Store
    {
      name: 'GET /forecast/store',
      method: 'get',
      url: '/forecast/store?datasetIdentifier=dataset_1'
    },
    {
      name: 'PUT /forecast/store/final',
      method: 'put',
      url: '/forecast/store/final',
      data: {
        datasetIdentifier: 'dataset_1',
        sku: 'SKU001',
        modelId: 'arima',
        forecasts: [110, 115, 120, 125],
        parameters: { p: 1, d: 1, q: 1 }
      }
    },
    {
      name: 'GET /forecast/store/final/status',
      method: 'get',
      url: '/forecast/store/final/status?datasetIdentifier=dataset_1'
    },
    {
      name: 'DELETE /forecast/store',
      method: 'delete',
      url: '/forecast/store?datasetIdentifier=dataset_1'
    },

    // Forecast Optimization
    {
      name: 'GET /forecast/optimization/1',
      method: 'get',
      url: '/forecast/optimization/1'
    },

    // Forecast Generation
    {
      name: 'POST /forecast/generate',
      method: 'post',
      url: '/forecast/generate',
      data: {
        datasetIdentifier: 'dataset_1',
        sku: 'SKU001',
        modelId: 'arima',
        method: 'grid',
        periods: 12,
        parameters: { p: 1, d: 1, q: 1 }
      }
    },

    // Dataset Frequency Management
    {
      name: 'POST /update-dataset-frequency',
      method: 'post',
      url: '/update-dataset-frequency',
      data: {
        datasetIdentifier: 'dataset_1',
        frequency: 'monthly'
      }
    },
    {
      name: 'POST /auto-detect-dataset-frequency',
      method: 'post',
      url: '/auto-detect-dataset-frequency',
      data: {
        datasetIdentifier: 'dataset_1'
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      
      const config = {
        method: test.method,
        url: `${BASE_URL}${test.url}`,
        timeout: 10000
      };

      if (test.data) {
        config.data = test.data;
      }

      const response = await axios(config);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ ${test.name} - PASSED (${response.status})`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED (${response.status})`);
        failed++;
      }
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        console.log(`⚠️  ${test.name} - ERROR (${error.response.status}): ${error.response.data?.error || error.message}`);
      } else if (error.request) {
        // Request was made but no response
        console.log(`❌ ${test.name} - NO RESPONSE: ${error.message}`);
      } else {
        // Other error
        console.log(`❌ ${test.name} - ERROR: ${error.message}`);
      }
      failed++;
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
};

// Wait for server to start
setTimeout(() => {
  testEndpoints().catch(console.error);
}, 3000); 