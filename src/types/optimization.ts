export interface OptimizationQueueItem {
  sku: string;
  modelId: string;
  reason:
    | 'csv_upload'
    | 'manual'
    | 'settings_change'
    | 'data_cleaning'
    | 'ai'
    | 'csv_upload_sales_data'
    | 'csv_upload_data_cleaning'
    | 'manual_edit_data_cleaning';
  method: 'ai' | 'grid';
  priority?: number;
  timestamp: number;
}

export interface OptimizationQueue {
  items: OptimizationQueueItem[];
  progress: Record<string, number>;
  isOptimizing: boolean;
  paused: boolean;
}

export interface OptimizationProgress {
  sku: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export type OptimizationType = 'ai' | 'grid' | 'manual';
export type OptimizationStatus = 'not_started' | 'queued' | 'running' | 'done' | 'error';

export interface OptimizationResult {
  parameters: Record<string, number>;
  accuracy: number;
  confidence?: number;
  reasoning?: string;
  updatedAt: string;
  isWinner?: boolean;
  // ...other metadata
}

export interface OptimizationState {
  status: OptimizationStatus;
  result?: OptimizationResult;
  error?: string;
}

export type ModelOptimizationState = {
  [optimizationType in OptimizationType]?: OptimizationState;
} & {
  selected?: OptimizationType; // Which result is currently selected for use
};

export type SKUModelOptimizationState = {
  [sku: string]: {
    [modelId: string]: ModelOptimizationState;
  };
}; 

export interface Job {
  id: number;
  userId: string;
  sku: string;
  modelId: string;
  method: 'grid' | 'ai';
  payload: string; // JSON string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  attempts: number;
  result: string | null; // JSON string
  error: string | null;
  priority: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
} 