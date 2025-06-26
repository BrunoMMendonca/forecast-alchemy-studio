import { useState, useEffect, useCallback } from 'react';
import { CsvUploadResult } from '@/components/CsvImportWizard';

interface DatasetFile {
  filename: string;
  filePath: string;
  hash: string;
  timestamp: number;
  size: number;
  modified: Date;
  type?: string;
}

interface Dataset {
  id: string;
  name: string;
  type: string;
  summary: {
    skuCount: number;
    dateRange: [string, string];
    totalPeriods: number;
  };
  filename: string;
  timestamp: number;
}

interface LastLoadedDataset {
  filePath: string;
  filename: string;
  name: string;
  timestamp: number;
  lastLoadedAt: number;
}

interface UseExistingDataDetectionReturn {
  datasets: Dataset[];
  isLoading: boolean;
  error: string | null;
  loadLatestCleanedData: (dataset: Dataset) => Promise<CsvUploadResult | null>;
  refreshDatasets: () => Promise<void>;
  lastLoadedDataset: LastLoadedDataset | null;
  autoLoadLastDataset: () => Promise<CsvUploadResult | null>;
  setLastLoadedDataset: (dataset: Dataset) => void;
}

const LAST_LOADED_DATASET_KEY = 'last_loaded_dataset';

export const useExistingDataDetection = (): UseExistingDataDetectionReturn => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedDataset, setLastLoadedDatasetState] = useState<LastLoadedDataset | null>(null);

  const fetchDatasets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/detect-existing-data');
      if (!response.ok) {
        throw new Error('Failed to detect existing data');
      }
      
      const data = await response.json();
      setDatasets(data.datasets || []);
      
      console.log(`[DETECT] Found ${data.datasets?.length || 0} existing datasets`);
    } catch (err) {
      console.error('Error detecting existing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to detect existing data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLatestCleanedData = useCallback(async (dataset: Dataset): Promise<CsvUploadResult | null> => {
    try {
      // Extract baseName and hash from the filename using the new naming convention
      // Format: Original_CSV_Upload-<timestamp>-<hash>-processed.json
      const match = dataset.filename.match(/^Original_CSV_Upload-(\d+)-([a-f0-9]{8})-processed\.json$/);
      if (!match) {
        console.error('[DETECT] Invalid filename format:', dataset.filename);
        return null;
      }
      
      const [, timestamp, hash] = match;
      const baseName = `Original_CSV_Upload-${timestamp}`;
      
      // Load the processed data using the new API format
      const response = await fetch(`/api/load-processed-data?baseName=${encodeURIComponent(baseName)}&hash=${encodeURIComponent(hash)}`);
      if (!response.ok) {
        throw new Error('Failed to load cleaned data');
      }
      
      const fileData = await response.json();
      
      // Create a CsvUploadResult from the loaded data
      const result: CsvUploadResult = {
        success: true,
        filePath: `uploads/${dataset.filename}`,
        summary: {
          skuCount: dataset.summary.skuCount,
          dateRange: dataset.summary.dateRange,
          totalPeriods: dataset.summary.totalPeriods,
        },
        skuList: fileData.data?.map((row: any) => row['Material Code']).filter(Boolean) || []
      };
      
      console.log(`[DETECT] Loaded existing data: ${dataset.name} -> ${dataset.filename}`);
      return result;
    } catch (err) {
      console.error('Error loading existing data:', err);
      return null;
    }
  }, []);

  // Load last loaded dataset from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_LOADED_DATASET_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLastLoadedDatasetState(parsed);
        console.log('[DETECT] Loaded last dataset info from localStorage:', parsed);
      }
    } catch (error) {
      console.error('[DETECT] Failed to load last dataset info:', error);
    }
  }, []);

  // Function to set the last loaded dataset
  const setLastLoadedDataset = useCallback((dataset: Dataset) => {
    const lastLoaded: LastLoadedDataset = {
      filePath: `uploads/${dataset.filename}`,
      filename: dataset.filename,
      name: dataset.name,
      timestamp: dataset.timestamp,
      lastLoadedAt: Date.now()
    };
    
    setLastLoadedDatasetState(lastLoaded);
    
    try {
      localStorage.setItem(LAST_LOADED_DATASET_KEY, JSON.stringify(lastLoaded));
      console.log('[DETECT] Saved last dataset info to localStorage:', lastLoaded);
    } catch (error) {
      console.error('[DETECT] Failed to save last dataset info:', error);
    }
  }, []);

  // Function to auto-load the last loaded dataset
  const autoLoadLastDataset = useCallback(async (): Promise<CsvUploadResult | null> => {
    if (!lastLoadedDataset) {
      console.log('[DETECT] No last loaded dataset found');
      return null;
    }

    // Check if the dataset still exists in the current datasets list
    const datasetExists = datasets.find(d => d.filename === lastLoadedDataset.filename);
    if (!datasetExists) {
      console.log('[DETECT] Last loaded dataset no longer exists:', lastLoadedDataset.filename);
      // Clear the stored info since the dataset is gone
      setLastLoadedDatasetState(null);
      localStorage.removeItem(LAST_LOADED_DATASET_KEY);
      return null;
    }

    console.log('[DETECT] Auto-loading last dataset:', lastLoadedDataset.name);
    return await loadLatestCleanedData(datasetExists);
  }, [lastLoadedDataset, datasets, loadLatestCleanedData]);

  // Auto-detect on mount
  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  return {
    datasets,
    isLoading,
    error,
    loadLatestCleanedData,
    refreshDatasets: fetchDatasets,
    lastLoadedDataset,
    autoLoadLastDataset,
    setLastLoadedDataset
  };
}; 