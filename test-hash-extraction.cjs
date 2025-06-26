const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = './uploads';

// Test the hash extraction logic
function testHashExtraction() {
  try {
    console.log('Current directory:', process.cwd());
    console.log('Uploads directory:', path.resolve(UPLOADS_DIR));
    
    // Check if directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.error('Uploads directory does not exist!');
      return;
    }
    
    // Try to find existing processed data file to get the hash
    const files = fs.readdirSync(UPLOADS_DIR);
    console.log('All files:', files);
    
    const processedFiles = files.filter(f => f.includes('-processed.json') && !f.includes('-discarded'));
    console.log('Processed files:', processedFiles);
    
    if (processedFiles.length > 0) {
      // Use the most recent processed file to get the hash
      const latestFile = processedFiles.sort().pop();
      console.log('Latest processed file:', latestFile);
      
      const filePath = path.join(UPLOADS_DIR, latestFile);
      console.log('Full file path:', filePath);
      
      try {
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log('File content keys:', Object.keys(fileContent));
        console.log('csvHash:', fileContent.csvHash);
        
        if (fileContent.csvHash) {
          const csvHash = fileContent.csvHash;
          // Extract baseName from the filename
          const match = latestFile.match(/Original_CSV_Upload-(\d+)-([a-f0-9]{8})-processed\.json/);
          console.log('Match result:', match);
          
          if (match) {
            const baseName = `Original_CSV_Upload-${match[1]}`;
            console.log('BaseName:', baseName);
            console.log('Hash:', csvHash);
            console.log('Short hash:', csvHash.slice(0, 8));
            
            // Use the new naming convention
            const fileName = `${baseName}-${csvHash.slice(0, 8)}-cleaning.json`;
            console.log('New filename:', fileName);
          }
        }
      } catch (err) {
        console.error('Error reading existing processed file:', err);
      }
    } else {
      console.log('No processed files found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testHashExtraction(); 