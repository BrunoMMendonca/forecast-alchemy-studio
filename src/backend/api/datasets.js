import express from 'express';
import { authenticateToken } from '../auth.js';
import { detectColumnRoles, parseCsvWithHeaders, parseDateWithFormat, parseNumberWithFormat, transposeData } from '../utils.js';
import Papa from 'papaparse';
import { pgPool } from '../db.js';

const router = express.Router();

// Generate preview of CSV data with column role detection
router.post('/generate-preview', authenticateToken, async (req, res) => {
  try {
    const { csvData, separator: requestedSeparator, dateFormat: requestedDateFormat, numberFormat: requestedNumberFormat, transposed } = req.body;

    if (!csvData) {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    console.log('[generate-preview] Received:', {
      separator: requestedSeparator,
      dateFormat: requestedDateFormat,
      numberFormat: requestedNumberFormat,
      transposed: transposed
    });

    // Use the robust parser with the requested separator
    let { data, headers, separator } = parseCsvWithHeaders(csvData, requestedSeparator);

    console.log('[generate-preview] Detected headers:', headers);

    if (transposed) {
      const transposedResult = transposeData(data, headers);
      data = transposedResult.data;
      headers = transposedResult.headers;
    }

    // Get column roles as objects first, passing the date format
    const columnRolesObjects = detectColumnRoles(headers, requestedDateFormat);
    // Extract just the role strings for the frontend
    const columnRoles = columnRolesObjects.map(obj => obj.role);

    console.log('[generate-preview] Detected column roles:', columnRoles);
    console.log('[generate-preview] Headers:', headers);

    // Process preview data to show how dates would be interpreted with the selected format
    const processedPreviewRows = data.slice(0, 100).map((row, rowIdx) => {
      const processedRow = {};
      headers.forEach((header, index) => {
        const value = row[header];
        const role = columnRoles[index];

        if (role === 'Date') {
          // For date columns, validate the cell value (sales numbers) against number format
          const parsedNumber = parseNumberWithFormat(value, requestedNumberFormat);
          if (!isNaN(parsedNumber)) {
            processedRow[header] = parsedNumber;
          } else {
            processedRow[header] = `❌ Invalid (${requestedNumberFormat})`;
          }
        } else {
          // For all non-date columns (Material Code, Description, aggregatable fields, etc.), 
          // keep the original value as text to preserve formatting like "03" instead of "3"
          processedRow[header] = value;
        }
      });
      return processedRow;
    });

    // Create processed headers array to show invalid date formats in headers
    // This is only for display - the data structure keeps original header names
    const processedHeaders = headers.map((header, index) => {
      const role = columnRoles[index];
      if (role === 'Date') {
        const isHeaderValid = parseDateWithFormat(header, requestedDateFormat) !== null;
        if (!isHeaderValid) {
          return `❌ Invalid (${requestedDateFormat})`;
        }
      }
      return header;
    });

    res.json({
      headers: processedHeaders.slice(0, 50),
      originalHeaders: headers.slice(0, 50), // Add original headers for data access
      previewRows: processedPreviewRows,
      columnRoles,
      separator,
      transposed: !!transposed,
      dateFormat: requestedDateFormat,
      numberFormat: requestedNumberFormat
    });

    console.log('[generate-preview] Sending response with processed data');
    console.log('[generate-preview] First row preview data:', processedPreviewRows[0]);

  } catch (error) {
    console.error('[generate-preview] Error:', error);
    res.status(500).json({ error: error.message });
  }
});



// GET /api/datasets/detect-existing-data - Detect existing datasets
router.get('/detect-existing-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    
    if (!companyId) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    console.log(`[detect-existing-data] User ${userId}, Company ${companyId}`);
    
    // Test database connection first
    try {
      await pgPool.query('SELECT 1 as test');
      console.log('[detect-existing-data] Database connection successful');
    } catch (dbError) {
      console.error('[detect-existing-data] Database connection failed:', dbError);
      return res.status(500).json({ error: 'Database connection failed', details: dbError.message });
    }
    
    // Get datasets for the company
    const datasetsQuery = `
      SELECT 
        d.id,
        d.name,
        d.file_path as filename,
        d.uploaded_at as timestamp,
        d.metadata
      FROM datasets d
      WHERE d.company_id = $1
      ORDER BY d.uploaded_at DESC
    `;
    
    const datasetsResult = await pgPool.query(datasetsQuery, [companyId]);
    console.log(`[detect-existing-data] Found ${datasetsResult.rows.length} datasets`);
    
    const datasets = datasetsResult.rows.map(row => {
      let metadata = {};
      try {
        metadata = row.metadata ? JSON.parse(row.metadata) : {};
      } catch (e) {
        console.warn(`[detect-existing-data] Failed to parse metadata for dataset ${row.id}:`, e);
      }
      
      return {
        id: row.id.toString(),
        name: row.name,
        type: 'csv',
        summary: {
          skuCount: metadata.skuCount || 0,
          dateRange: metadata.dateRange || ['', ''],
          totalPeriods: metadata.totalPeriods || 0,
          frequency: metadata.frequency || 'monthly'
        },
        filename: row.filename,
        timestamp: new Date(row.timestamp).getTime()
      };
    });
    
    res.json({ datasets });
  } catch (error) {
    console.error('Error detecting existing data:', error);
    res.status(500).json({ error: 'Failed to detect existing data', details: error.message });
  }
});

// GET /api/datasets/load-processed-data - Load processed data for a dataset
router.get('/load-processed-data', authenticateToken, async (req, res) => {
  try {
    const { datasetId } = req.query;
    const userId = req.user.id;
    
    if (!datasetId) {
      return res.status(400).json({ error: 'Dataset ID is required' });
    }
    
    // Verify user has access to this dataset
    const accessQuery = `
      SELECT d.id, d.company_id 
      FROM datasets d
      JOIN users u ON d.company_id = u.company_id
      WHERE d.id = $1 AND u.id = $2
    `;
    
    const accessResult = await pgPool.query(accessQuery, [datasetId, userId]);
    
    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get time series data for this dataset
    const dataQuery = `
      SELECT 
        tsd.sku_code,
        tsd.date,
        tsd.value,
        tsd.period
      FROM time_series_data tsd
      WHERE tsd.dataset_id = $1
      ORDER BY tsd.sku_code, tsd.date
    `;
    
    const dataResult = await pgPool.query(dataQuery, [datasetId]);
    
    // Transform data to the expected format
    const transformedData = dataResult.rows.map(row => ({
      'Material Code': row.sku_code,
      'Date': row.date,
      'Value': row.value,
      'Period': row.period
    }));
    
    res.json({ data: transformedData });
  } catch (error) {
    console.error('Error loading processed data:', error);
    res.status(500).json({ error: 'Failed to load processed data' });
  }
});

// TODO: Move dataset-related endpoints from routes.js to here
// This includes:
// - GET /datasets
// - GET /datasets/:datasetId
// - DELETE /datasets/:datasetId
// - POST /datasets/:id/rename
// - POST /update-dataset-frequency
// - POST /auto-detect-dataset-frequency
// - POST /generate-preview

export default router; 