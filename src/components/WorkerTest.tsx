import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkerManager } from '@/hooks/useWorkerManager';
import { WorkerProgressIndicator } from './WorkerProgressIndicator';

export const WorkerTest: React.FC = () => {
  const { 
    runDataProcessing, 
    runOptimization, 
    runForecast, 
    runBatchOptimization,
    isWorking, 
    progress, 
    progressMessage,
    terminateWorker 
  } = useWorkerManager();

  const testDataProcessing = async () => {
    try {
      const result = await runDataProcessing({
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() })),
        operation: 'transform'
      });
      console.log('Data processing result:', result);
    } catch (error) {
      console.error('Data processing error:', error);
    }
  };

  const testOptimization = async () => {
    try {
      const result = await runOptimization({
        type: 'grid',
        model: {
          id: 'test_model',
          name: 'Test Model',
          enabled: true,
          parameters: { alpha: 0.3, beta: 0.1 }
        },
        skuData: Array.from({ length: 100 }, (_, i) => ({
          date: new Date(2023, 0, i + 1).toISOString(),
          sales: Math.random() * 100
        })),
        sku: 'TEST_SKU'
      });
      console.log('Optimization result:', result);
    } catch (error) {
      console.error('Optimization error:', error);
    }
  };

  const testForecast = async () => {
    try {
      const result = await runForecast({
        selectedSKU: 'TEST_SKU',
        data: Array.from({ length: 100 }, (_, i) => ({
          'Material Code': 'TEST_SKU',
          'Date': new Date(2023, 0, i + 1).toISOString(),
          'Sales': Math.random() * 100
        })),
        models: [{
          id: 'test_model',
          name: 'Test Model',
          enabled: true,
          parameters: { alpha: 0.3 }
        }],
        forecastPeriods: 12,
        aiForecastModelOptimizationEnabled: true
      });
      console.log('Forecast result:', result);
    } catch (error) {
      console.error('Forecast error:', error);
    }
  };

  const testBatchOptimization = async () => {
    try {
      const result = await runBatchOptimization({
        models: [{
          id: 'test_model',
          name: 'Test Model',
          enabled: true,
          parameters: { alpha: 0.3, beta: 0.1 }
        }],
        skuData: Array.from({ length: 100 }, (_, i) => ({
          date: new Date(2023, 0, i + 1).toISOString(),
          sales: Math.random() * 100
        })),
        sku: 'TEST_SKU',
        aiForecastModelOptimizationEnabled: true
      });
      console.log('Batch optimization result:', result);
    } catch (error) {
      console.error('Batch optimization error:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Worker System Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button onClick={testDataProcessing} disabled={isWorking}>
            Test Data Processing
          </Button>
          <Button onClick={testOptimization} disabled={isWorking}>
            Test Optimization
          </Button>
          <Button onClick={testForecast} disabled={isWorking}>
            Test Forecast
          </Button>
          <Button onClick={testBatchOptimization} disabled={isWorking}>
            Test Batch Optimization
          </Button>
        </div>
        
        <Button 
          onClick={terminateWorker} 
          variant="destructive" 
          disabled={!isWorking}
        >
          Terminate Worker
        </Button>

        <WorkerProgressIndicator
          isWorking={isWorking}
          progress={progress}
          message={progressMessage}
          title="Worker Test"
        />
      </CardContent>
    </Card>
  );
}; 