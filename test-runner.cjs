#!/usr/bin/env node

const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Simple fetch implementation for Node.js
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: () => {
            try {
              return Promise.resolve(JSON.parse(data));
            } catch (error) {
              return Promise.reject(error);
            }
          },
          text: () => Promise.resolve(data)
        };
        
        resolve(response);
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🧪 Multi-Tenant System Test Runner');
console.log('=' .repeat(50));

const testOptions = [
  { id: 1, name: 'Quick System Test', file: 'test-simple-user-scenarios.cjs', description: 'Basic functionality test' },
  { id: 2, name: 'User Type Testing', file: 'test-different-user-types.cjs', description: 'Test different user roles' },
  { id: 3, name: 'Complete System Test', file: 'test-complete-multi-tenant-system.cjs', description: 'Full system validation' },
  { id: 4, name: 'Manual Testing Guide', description: 'Open testing guide in browser' },
  { id: 5, name: 'Check System Status', description: 'Verify backend and database' },
  { id: 6, name: 'Clean Test Data', description: 'Remove test data from database' },
  { id: 7, name: 'Exit', description: 'Exit test runner' }
];

function showMenu() {
  console.log('\n📋 Available Tests:');
  testOptions.forEach(option => {
    console.log(`   ${option.id}. ${option.name} - ${option.description}`);
  });
}

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${testFile}...`);
    console.log('─'.repeat(50));
    
    const child = exec(`node ${testFile}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Test failed: ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`⚠️  Warnings: ${stderr}`);
      }
      
      console.log(stdout);
      resolve();
    });
    
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  });
}

async function checkSystemStatus() {
  console.log('\n🔍 Checking System Status...');
  console.log('─'.repeat(50));
  
  try {
    // Check if backend is running
    const response = await fetch('http://localhost:3001/api/health');
    if (response.ok) {
      console.log('✅ Backend server is running');
    } else {
      console.log('❌ Backend server is not responding correctly');
    }
  } catch (error) {
    console.log('❌ Backend server is not running');
    console.log('   Start it with: npm run dev');
  }
  
  // Check if database files exist
  if (fs.existsSync('forecast-jobs.db')) {
    console.log('✅ Database file exists');
  } else {
    console.log('❌ Database file not found');
  }
  
  // Check if test files exist
  const testFiles = [
    'test-simple-user-scenarios.cjs',
    'test-different-user-types.cjs',
    'test-complete-multi-tenant-system.cjs'
  ];
  
  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} not found`);
    }
  });
}

async function cleanTestData() {
  console.log('\n🧹 Cleaning Test Data...');
  console.log('─'.repeat(50));
  
  // This would typically connect to the database and clean test data
  // For now, we'll just show what would be cleaned
  console.log('Would clean:');
  console.log('   - Test users (email contains "test" or timestamp)');
  console.log('   - Test companies');
  console.log('   - Test divisions and clusters');
  console.log('   - Test S&OP cycles');
  
  console.log('\n⚠️  Note: This is a placeholder. Implement actual cleanup based on your needs.');
}

function openTestingGuide() {
  console.log('\n📖 Opening Testing Guide...');
  console.log('─'.repeat(50));
  
  const guidePath = 'MANUAL-TESTING-GUIDE.md';
  if (fs.existsSync(guidePath)) {
    console.log(`✅ Guide found: ${guidePath}`);
    console.log('   Open this file in your text editor or browser');
  } else {
    console.log('❌ Testing guide not found');
  }
}

async function main() {
  while (true) {
    showMenu();
    
    const answer = await new Promise(resolve => {
      rl.question('\n🎯 Select a test to run (1-7): ', resolve);
    });
    
    const choice = parseInt(answer);
    
    switch (choice) {
      case 1:
        try {
          await runTest('test-simple-user-scenarios.cjs');
        } catch (error) {
          console.log('Test failed. Check the error above.');
        }
        break;
        
      case 2:
        try {
          await runTest('test-different-user-types.cjs');
        } catch (error) {
          console.log('Test failed. Check the error above.');
        }
        break;
        
      case 3:
        try {
          await runTest('test-complete-multi-tenant-system.cjs');
        } catch (error) {
          console.log('Test failed. Check the error above.');
        }
        break;
        
      case 4:
        openTestingGuide();
        break;
        
      case 5:
        await checkSystemStatus();
        break;
        
      case 6:
        await cleanTestData();
        break;
        
      case 7:
        console.log('\n👋 Goodbye!');
        rl.close();
        return;
        
      default:
        console.log('❌ Invalid choice. Please select 1-7.');
    }
    
    console.log('\n' + '─'.repeat(50));
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Test runner interrupted. Goodbye!');
  rl.close();
  process.exit(0);
});

// Start the test runner
main().catch(error => {
  console.error('💥 Test runner failed:', error);
  rl.close();
  process.exit(1);
}); 