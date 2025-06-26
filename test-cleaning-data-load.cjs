const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = './uploads';

// Test the cleaning data loading logic
function testCleaningDataLoad() {
  try {
    console.log('Current directory:', process.cwd());
    console.log('Uploads directory:', path.resolve(UPLOADS_DIR));
    
    // Check if directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.error('Uploads directory does not exist!');
      return;
    }
    
    // Get all files
    const files = fs.readdirSync(UPLOADS_DIR);
    console.log('All files:', files);
    
    // Find processed files
    const processedFiles = files.filter(f => /^Original_CSV_Upload-\d+-[a-f0-9]{8}-processed\.json$/.test(f) && !f.includes('-discarded'));
    console.log('Processed files:', processedFiles);
    
    // Find cleaning files
    const cleaningFiles = files.filter(f => /^Original_CSV_Upload-\d+-[a-f0-9]{8}-cleaning\.json$/.test(f) && !f.includes('-discarded'));
    console.log('Cleaning files:', cleaningFiles);
    
    // Test for each processed file
    processedFiles.forEach(processedFile => {
      const match = processedFile.match(/^Original_CSV_Upload-(\d+)-([a-f0-9]{8})-processed\.json$/);
      if (match) {
        const [, timestamp, hash] = match;
        const baseName = `Original_CSV_Upload-${timestamp}`;
        
        console.log(`\n--- Testing dataset: ${baseName} (hash: ${hash}) ---`);
        
        // Check if cleaning data exists
        const expectedCleaningFile = `${baseName}-${hash}-cleaning.json`;
        const cleaningFileExists = cleaningFiles.includes(expectedCleaningFile);
        
        console.log(`Expected cleaning file: ${expectedCleaningFile}`);
        console.log(`Cleaning file exists: ${cleaningFileExists}`);
        
        if (cleaningFileExists) {
          const cleaningFilePath = path.join(UPLOADS_DIR, expectedCleaningFile);
          try {
            const cleaningData = JSON.parse(fs.readFileSync(cleaningFilePath, 'utf8'));
            console.log(`Cleaning data structure:`, {
              hasData: !!cleaningData.data,
              dataLength: cleaningData.data?.length || 0,
              csvHash: cleaningData.csvHash,
              source: cleaningData.source
            });
          } catch (err) {
            console.error(`Error reading cleaning file:`, err);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCleaningDataLoad(); 