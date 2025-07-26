import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface Optimization {
  optimizationId: string;
  modelId: string;
  modelDisplayName: string;
  modelShortName: string;
  method: string;
  methodDisplayName: string;
  methodShortName: string;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  progress: number;
  jobs: any[];
}

export interface OptimizationBatch {
  batchId: string;
  batchTimestamp?: number;
  sku: string;
  skuDescription: string;
  datasetId: number;
  reason: string;
  priority: number;
  createdAt: string;
  optimizations: Record<string, Optimization>;
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  skippedJobs: number;
  progress: number;
  isOptimizing: boolean;
  methods: string[];
  models: string[];
}

export interface SKUGroup {
  sku: string;
  skuDescription: string;
  datasetId: number;
  batches: Record<string, OptimizationBatch>;
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  skippedJobs: number;
  progress: number;
  isOptimizing: boolean;
  methods: string[];
  models: string[];
}

// Keep the old interface for backward compatibility
export interface OptimizationStatus extends OptimizationBatch {}

export interface OptimizationSummary {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  skipped: number; // New field for skipped jobs
  isOptimizing: boolean;
  progress: number;
}

export const useOptimizationStatus = () => {
  const [skuGroups, setSkuGroups] = useState<SKUGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Changed from true to false
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOptimizations = useCallback(async () => {
    // Check if user is authenticated before making API calls
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      console.log('[useOptimizationStatus] No session token found, skipping fetch');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/optimizations/status', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch optimization status');
      }
      
      const responseJson = await response.json();
      const data: SKUGroup[] = Array.isArray(responseJson.optimizations) ? responseJson.optimizations : [];
      setSkuGroups(data);
      // If data is empty, clear any previous error
      if (!data || data.length === 0) {
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      // Only set error if it's a real backend/network error
      if (errorMessage !== 'Failed to fetch optimization status') {
      setError(errorMessage);
      } else {
        setError(null); // Don't show error for empty data
      }
      console.error('[useOptimizationStatus] Error fetching optimizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelOptimization = useCallback(async (optimizationId: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const response = await fetch(`/api/optimizations/${optimizationId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel optimization');
      }
      
      const result = await response.json();
      toast({
        title: 'Optimization Cancelled',
        description: result.message,
        variant: 'default',
      });
      
      // Refresh the optimizations list
      await fetchOptimizations();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [fetchOptimizations, toast]);

  const pauseOptimization = useCallback(async (optimizationId: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const response = await fetch(`/api/optimizations/${optimizationId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pause optimization');
      }
      
      const result = await response.json();
      toast({
        title: 'Optimization Paused',
        description: result.message,
        variant: 'default',
      });
      
      // Refresh the optimizations list
      await fetchOptimizations();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [fetchOptimizations, toast]);

  const resumeOptimization = useCallback(async (optimizationId: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const response = await fetch(`/api/optimizations/${optimizationId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume optimization');
      }
      
      const result = await response.json();
      toast({
        title: 'Optimization Resumed',
        description: result.message,
        variant: 'default',
      });
      
      // Refresh the optimizations list
      await fetchOptimizations();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [fetchOptimizations, toast]);

  // Memoize the summary calculation to prevent unnecessary recalculations
  const summary = useMemo(() => {
    const calculatedSummary = skuGroups.reduce(
      (acc, skuGroup) => {
        acc.total += skuGroup.totalJobs;
        acc.pending += skuGroup.pendingJobs;
        acc.running += skuGroup.runningJobs;
        acc.completed += skuGroup.completedJobs;
        acc.failed += skuGroup.failedJobs;
        acc.cancelled += skuGroup.cancelledJobs;
        acc.skipped += skuGroup.skippedJobs || 0;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        skipped: 0,
        isOptimizing: false,
        progress: 0,
      }
    );

    // Calculate overall progress and optimization status
    const totalProcessable = calculatedSummary.total - calculatedSummary.cancelled;
    calculatedSummary.progress = totalProcessable > 0 ? Math.round(((calculatedSummary.completed + calculatedSummary.failed) / totalProcessable) * 100) : 0;
    calculatedSummary.isOptimizing = calculatedSummary.pending > 0 || calculatedSummary.running > 0;

    return calculatedSummary;
  }, [skuGroups]);

  // Memoize the filtered optimizations to prevent unnecessary recalculations
  const activeOptimizations = useMemo(() => {
    const activeBatches: OptimizationBatch[] = [];
    skuGroups.forEach(skuGroup => {
      if (skuGroup.batches && typeof skuGroup.batches === 'object') {
      Object.values(skuGroup.batches).forEach(batch => {
          if (batch && batch.isOptimizing) {
          activeBatches.push(batch);
        }
      });
      }
    });
    return activeBatches;
  }, [skuGroups]);
  
  const completedOptimizations = useMemo(() => {
    const completedBatches: OptimizationBatch[] = [];
    skuGroups.forEach(skuGroup => {
      if (skuGroup.batches && typeof skuGroup.batches === 'object') {
      Object.values(skuGroup.batches).forEach(batch => {
        // Only show in completed if not active and has completed jobs but no failed jobs
          if (batch && !batch.isOptimizing && batch.completedJobs > 0 && batch.failedJobs === 0) {
          completedBatches.push(batch);
        }
      });
      }
    });
    return completedBatches;
  }, [skuGroups]);
  
  const failedOptimizations = useMemo(() => {
    const failedBatches: OptimizationBatch[] = [];
    skuGroups.forEach(skuGroup => {
      if (skuGroup.batches && typeof skuGroup.batches === 'object') {
      Object.values(skuGroup.batches).forEach(batch => {
        // Only show in failed if not active and has failed jobs
          if (batch && !batch.isOptimizing && batch.failedJobs > 0) {
          failedBatches.push(batch);
        }
      });
      }
    });
    return failedBatches;
  }, [skuGroups]);

  const skippedOptimizations = useMemo(() => {
    const skippedBatches: OptimizationBatch[] = [];
    skuGroups.forEach(skuGroup => {
      if (skuGroup.batches && typeof skuGroup.batches === 'object') {
      Object.values(skuGroup.batches).forEach(batch => {
        // Only show in skipped if not active, no completed jobs, no failed jobs, but has skipped jobs
          if (batch && !batch.isOptimizing && batch.completedJobs === 0 && batch.failedJobs === 0 && batch.skippedJobs > 0) {
          skippedBatches.push(batch);
        }
      });
      }
    });
    return skippedBatches;
  }, [skuGroups]);

  useEffect(() => {
    // Check if user is authenticated before starting polling
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      console.log('[useOptimizationStatus] No session token found, not starting polling');
      return;
    }

    fetchOptimizations();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      // Check again before each poll to ensure user is still authenticated
      const currentToken = localStorage.getItem('sessionToken');
      if (currentToken) {
        fetchOptimizations();
      } else {
        console.log('[useOptimizationStatus] Session token lost, stopping polling');
        clearInterval(interval);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchOptimizations]);

  // Memoize the return object to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    skuGroups,
    activeOptimizations,
    completedOptimizations,
    failedOptimizations,
    skippedOptimizations,
    summary,
    isLoading,
    error,
    fetchOptimizations,
    cancelOptimization,
    pauseOptimization,
    resumeOptimization,
  }), [
    skuGroups,
    activeOptimizations,
    completedOptimizations,
    failedOptimizations,
    skippedOptimizations,
    summary,
    fetchOptimizations,
    cancelOptimization,
    pauseOptimization,
    resumeOptimization,
  ]);

  return returnValue;
}; 