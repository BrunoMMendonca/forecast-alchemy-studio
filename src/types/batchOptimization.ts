
export interface BatchOptimizationProgress {
  currentSKU: string;
  completedSKUs: number;
  totalSKUs: number;
  currentModel: string;
  skipped: number;
  optimized: number;
  aiOptimized: number;
  gridOptimized: number;
  aiRejected: number;
  aiAcceptedByTolerance: number;
  aiAcceptedByConfidence: number;
}

export interface OptimizationResult {
  parameters: Record<string, number>;
  confidence: number;
  method: string;
}
