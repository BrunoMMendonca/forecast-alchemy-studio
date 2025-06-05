
export interface OptimizationFactors {
  stability: number;
  interpretability: number;
  complexity: number;
  businessImpact: string;
}

export interface OptimizationCallback {
  (
    sku: string,
    modelId: string,
    parameters: Record<string, number>,
    confidence: number,
    reasoning: string,
    factors: OptimizationFactors,
    expectedAccuracy: number,
    method: string
  ): void;
}

export interface CompletionCallback {
  (sku: string): void;
}

export interface SKUFilterCallback {
  (sku: string, modelIds: string[]): string[];
}
