import { useState, useEffect, useCallback } from 'react';
import { CsvUploadResult } from '@/components/CsvImportWizard';

interface DatasetFile {
  filename: string;
  datasetId: number;
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
    frequency?: string;
  };
  filename: string;
  timestamp: number;
}

interface LastLoadedDataset {
  datasetId: number;
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
      
    } catch (err) {
      console.error('Error detecting existing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to detect existing data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLatestCleanedData = useCallback(async (dataset: Dataset): Promise<CsvUploadResult | null> => {
    try {
      // Load the processed data using the dataset ID from the database
      const response = await fetch(`/api/load-processed-data?datasetId=${dataset.id}`);
      if (!response.ok) {
        throw new Error('Failed to load cleaned data');
      }
      
      const fileData = await response.json();
      
      // Create a CsvUploadResult from the loaded data
      const result: CsvUploadResult = {
        success: true,
        datasetId: parseInt(dataset.id),
        summary: {
          skuCount: dataset.summary.skuCount,
          dateRange: dataset.summary.dateRange,
          totalPeriods: dataset.summary.totalPeriods,
        },
        skuList: fileData.data?.map((row: any) => row['Material Code']).filter(Boolean) || []
      };
      
      console.log(`[DETECT] Loaded existing data: ${dataset.name} -> dataset_${dataset.id}`);
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
      }
    } catch (error) {
      console.error('[DETECT] Failed to load last dataset info:', error);
    }
  }, []);

  // Function to set the last loaded dataset
  const setLastLoadedDataset = useCallback((dataset: Dataset) => {
    const lastLoaded: LastLoadedDataset = {
      datasetId: parseInt(dataset.id),
      filename: dataset.filename,
      name: dataset.name,
      timestamp: dataset.timestamp,
      lastLoadedAt: Date.now()
    };
    
    setLastLoadedDatasetState(lastLoaded);
    
    try {
      localStorage.setItem(LAST_LOADED_DATASET_KEY, JSON.stringify(lastLoaded));
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
    // Try to match by filename first (for backward compatibility)
    let datasetExists = datasets.find(d => d.filename === lastLoadedDataset.filename);
    
    // If not found by filename, try to match by datasetId
    if (!datasetExists && lastLoadedDataset.datasetId) {
      datasetExists = datasets.find(d => d.id === lastLoadedDataset.datasetId.toString());
    }
    
    if (!datasetExists) {
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