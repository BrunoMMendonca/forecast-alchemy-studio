import { ForecastResult } from '@/types/forecast';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';

export interface ForecastGenerationRequest {
  sku: string | string[]; // Support both single SKU and array of SKUs
  data: SalesData[];
  models: ModelConfig[];
  forecastPeriods: number | number[]; // Support both single period and array of periods
  datasetId?: number;
  companyId?: string; // New: company identifier
  method?: string; // New: method type (manual, grid, ai)
}

export interface ForecastGenerationResponse {
  results: Array<{
    sku: string;
    modelId: string;
    modelName: string;
    datasetId: number;
    companyId: string;
    methods: Array<{
      methodId: string;
      methodType: string;
      periods: Array<{
        periodId: string;
        periods: number;
        parameters: Record<string, any>;
        accuracy: number;
        generatedAt: string;
        predictions: Array<{
          date: string;
          value: number;
        }>;
        error?: string;
      }>;
      error?: string;
    }>;
    generatedAt: string;
  }>;
  metadata: {
    companyId: string;
    datasetId: number;
    totalSKUs: number;
    totalModels: number;
    totalPeriods: number;
    generatedAt: string;
  };
}

// New interfaces for forecast store operations
export interface ForecastStoreRequest {
  companyId: string;
  datasetId: number;
  sku: string;
  modelId: string;
  methodId: string;
  periodId: string;
  data: any;
}

export interface ForecastStoreResponse {
  success: boolean;
  forecast?: any;
  forecasts?: any[];
  deletedCount?: number;
  message?: string;
  filters?: any;
}

/**
 * Generate forecasts using the backend API
 * Supports both single SKU and multiple SKUs
 */
export const generateForecasts = async (
  request: ForecastGenerationRequest
): Promise<ForecastResult[]> => {
  try {
    // Handle single SKU vs multiple SKUs
    const skus = Array.isArray(request.sku) ? request.sku : [request.sku];
    
    if (skus.length === 1) {
      // Single SKU - use existing endpoint
    const response = await fetch('/api/forecast/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          ...request,
          sku: skus[0] // Ensure single SKU format
        }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ForecastGenerationResponse = await response.json();
    
      // Transform hierarchical backend response to frontend format
      const transformedResults: ForecastResult[] = [];
      
      for (const result of data.results) {
        for (const method of result.methods) {
          if (method.error) {
            // Handle method-level error
            transformedResults.push({
              sku: result.sku,
              model: result.modelId,
              predictions: [],
              parameters: {},
              isValid: false,
            });
            continue;
          }
          
          for (const period of method.periods) {
            if (period.error) {
                          // Handle period-level error
            transformedResults.push({
              sku: result.sku,
              model: result.modelId,
              predictions: [],
              parameters: period.parameters,
              isValid: false,
            });
              continue;
            }
            
            // Successful forecast
            transformedResults.push({
      sku: result.sku,
              model: result.modelId,
              predictions: period.predictions.map(pred => ({
        date: pred.date,
        value: pred.value,
      })),
              parameters: period.parameters,
              isValid: true,
            });
          }
        }
      }
      
      return transformedResults;
    } else {
      // Multiple SKUs - use batch processing
      return await generateForecastsForMultipleSKUs(request);
    }
  } catch (error) {
    console.error('Forecast generation failed:', error);
    throw error;
  }
};

/**
 * Generate forecasts for multiple SKUs using parallel requests
 */
const generateForecastsForMultipleSKUs = async (
  request: ForecastGenerationRequest
): Promise<ForecastResult[]> => {
  const skus = Array.isArray(request.sku) ? request.sku : [request.sku];
  const results: ForecastResult[] = [];
  
  // Process SKUs in parallel with concurrency limit
  const concurrencyLimit = 3; // Limit concurrent requests to avoid overwhelming the backend
  const chunks = [];
  
  for (let i = 0; i < skus.length; i += concurrencyLimit) {
    chunks.push(skus.slice(i, i + concurrencyLimit));
  }
  
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (sku) => {
      try {
        const response = await fetch('/api/forecast/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...request,
            sku: sku
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ForecastGenerationResponse = await response.json();
        
        // Transform hierarchical backend response to frontend format
        const transformedResults: ForecastResult[] = [];
        
        for (const result of data.results) {
          for (const method of result.methods) {
            if (method.error) {
              // Handle method-level error
              transformedResults.push({
                sku: result.sku,
                model: result.modelId,
                predictions: [],
                parameters: {},
                isValid: false,
              });
              continue;
            }
            
            for (const period of method.periods) {
              if (period.error) {
                // Handle period-level error
                transformedResults.push({
                  sku: result.sku,
                  model: result.modelId,
                  predictions: [],
                  parameters: period.parameters,
                  isValid: false,
                });
                continue;
              }
              
              // Successful forecast
              transformedResults.push({
                sku: result.sku,
                model: result.modelId,
                predictions: period.predictions.map(pred => ({
                  date: pred.date,
                  value: pred.value,
                })),
                parameters: period.parameters,
                isValid: true,
              });
            }
          }
        }
        
        return transformedResults;
      } catch (error) {
        console.error(`Forecast generation failed for SKU ${sku}:`, error);
        // Return error results for this SKU
        return request.models.map(model => ({
          sku: sku,
          model: model.id,
          predictions: [],
          parameters: model.parameters,
          isValid: false,
        }));
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults.flat());
  }
  
  return results;
};

/**
 * Enhanced forecast generation with progress tracking
 */
export const generateForecastsWithProgress = async (
  request: ForecastGenerationRequest,
  onProgress?: (progress: { current: number; total: number; sku: string }) => void
): Promise<ForecastResult[]> => {
  const skus = Array.isArray(request.sku) ? request.sku : [request.sku];
  const results: ForecastResult[] = [];
  
  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    
    if (onProgress) {
      onProgress({ current: i + 1, total: skus.length, sku });
    }
    
    try {
      const response = await fetch('/api/forecast/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          sku: sku
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ForecastGenerationResponse = await response.json();
      
      // Transform hierarchical backend response to frontend format
      const skuResults: ForecastResult[] = [];
      
      for (const result of data.results) {
        for (const method of result.methods) {
          if (method.error) {
            // Handle method-level error
            skuResults.push({
              sku: result.sku,
              model: result.modelId,
              predictions: [],
              parameters: {},
              isValid: false,
            });
            continue;
          }
          
          for (const period of method.periods) {
            if (period.error) {
              // Handle period-level error
              skuResults.push({
                sku: result.sku,
                model: result.modelId,
                predictions: [],
                parameters: period.parameters,
                isValid: false,
              });
              continue;
            }
            
            // Successful forecast
            skuResults.push({
              sku: result.sku,
              model: result.modelId,
              predictions: period.predictions.map(pred => ({
                date: pred.date,
                value: pred.value,
              })),
              parameters: period.parameters,
              isValid: true,
            });
          }
        }
      }
      
      results.push(...skuResults);
    } catch (error) {
      console.error(`Forecast generation failed for SKU ${sku}:`, error);
      // Return error results for this SKU
      const errorResults = request.models.map(model => ({
        sku: sku,
        model: model.id,
        predictions: [],
        parameters: model.parameters,
        isValid: false,
      }));
      results.push(...errorResults);
    }
  }
  
  return results;
};

/**
 * Check if the backend forecast service is available
 */
export const checkForecastServiceHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch('/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend forecast service health check failed:', error);
    return false;
  }
};

/**
 * Store forecast data in the backend
 */
export const storeForecast = async (request: ForecastStoreRequest): Promise<ForecastStoreResponse> => {
  try {
    const response = await fetch('/api/forecast/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Forecast store failed:', error);
    throw error;
  }
};

/**
 * Retrieve forecast data from the backend
 */
export const getForecasts = async (filters: Partial<ForecastStoreRequest>): Promise<ForecastStoreResponse> => {
  try {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(`/api/forecast/store?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Forecast retrieval failed:', error);
    throw error;
  }
};

/**
 * Delete forecast data from the backend
 */
export const deleteForecasts = async (filters: Partial<ForecastStoreRequest>): Promise<ForecastStoreResponse> => {
  try {
    const response = await fetch('/api/forecast/store', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Forecast deletion failed:', error);
    throw error;
  }
}; 
 
 
 