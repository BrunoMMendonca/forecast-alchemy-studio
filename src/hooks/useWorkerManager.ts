import { useCallback, useRef, useState } from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/types/forecast';
import { NormalizedSalesData, ForecastResult } from '@/pages/Index';
import { BusinessContext } from '@/types/businessContext';

interface WorkerMessage {
  type: 'progress' | 'result';
  progress?: number;
  message?: string;
  result?: any;
}

interface UseWorkerManagerReturn {
  runOptimization: (job: any) => Promise<any>;
  runForecast: (job: any) => Promise<ForecastResult[]>;
  runBatchOptimization: (job: any) => Promise<any>;
  runDataProcessing: (job: any) => Promise<any>;
  isWorking: boolean;
  progress: number;
  progressMessage: string;
  terminateWorker: () => void;
}

export const useWorkerManager = (): UseWorkerManagerReturn => {
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const workerRef = useRef<Worker | null>(null);

  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    workerRef.current = new Worker(
      new URL('../workers/comprehensiveWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    return workerRef.current;
  }, []);

  const runWorkerJob = useCallback(async (job: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const worker = createWorker();
      
      setIsWorking(true);
      setProgress(0);
      setProgressMessage('Starting...');

      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, progress: prog, message, result } = event.data;
        
        if (type === 'progress') {
          setProgress(prog || 0);
          if (message) setProgressMessage(message);
        } else if (type === 'result') {
          setIsWorking(false);
          setProgress(100);
          setProgressMessage('Completed');
          
          if (result?.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
          
          worker.removeEventListener('message', handleMessage);
          worker.terminate();
          workerRef.current = null;
        }
      };

      const handleError = (error: ErrorEvent) => {
        setIsWorking(false);
        setProgress(0);
        setProgressMessage('Error occurred');
        reject(new Error(error.message));
        worker.removeEventListener('error', handleError);
        worker.terminate();
        workerRef.current = null;
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      
      worker.postMessage({ job });
    });
  }, [createWorker]);

  const runOptimization = useCallback(async (job: {
    type: 'grid' | 'ai';
    model: ModelConfig;
    skuData: SalesData[];
    sku: string;
    businessContext?: BusinessContext;
    aiForecastModelOptimizationEnabled?: boolean;
  }) => {
    // DISABLED: Frontend optimization is now handled by the backend
    console.log('Frontend optimization disabled - use backend system instead');
    return { error: 'Frontend optimization disabled - use backend system' };
    // return runWorkerJob(job);
  }, [runWorkerJob]);

  const runForecast = useCallback(async (job: {
    selectedSKU: string;
    data: NormalizedSalesData[];
    models: ModelConfig[];
    forecastPeriods: number;
    aiForecastModelOptimizationEnabled: boolean;
  }): Promise<ForecastResult[]> => {
    // DISABLED: Frontend forecast generation is now handled by the backend
    console.log('Frontend forecast generation disabled - use backend system instead');
    return [];
    // const result = await runWorkerJob({
    //   type: 'forecast',
    //   ...job
    // });
    // return result;
  }, [runWorkerJob]);

  const runBatchOptimization = useCallback(async (job: {
    models: ModelConfig[];
    skuData: SalesData[];
    sku: string;
    businessContext?: BusinessContext;
    aiForecastModelOptimizationEnabled: boolean;
  }) => {
    // DISABLED: Frontend batch optimization is now handled by the backend
    console.log('Frontend batch optimization disabled - use backend system instead');
    return { error: 'Frontend batch optimization disabled - use backend system' };
    // return runWorkerJob({
    //   type: 'batch_optimization',
    //   ...job
    // });
  }, [runWorkerJob]);

  const runDataProcessing = useCallback(async (job: {
    data: any[];
    operation: 'clean' | 'validate' | 'transform';
    options?: any;
  }) => {
    // DISABLED: Frontend data processing is now handled by the backend
    console.log('Frontend data processing disabled - use backend system instead');
    return { error: 'Frontend data processing disabled - use backend system' };
    // return runWorkerJob({
    //   type: 'data_processing',
    //   ...job
    // });
  }, [runWorkerJob]);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsWorking(false);
    setProgress(0);
    setProgressMessage('');
  }, []);

  return {
    runOptimization,
    runForecast,
    runBatchOptimization,
    runDataProcessing,
    isWorking,
    progress,
    progressMessage,
    terminateWorker
  };
}; 