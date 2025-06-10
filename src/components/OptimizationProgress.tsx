import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptimizationQueue } from "@/types/optimization";

interface OptimizationProgressProps {
  queueSize: number;
  uniqueSKUCount: number;
  isOptimizing: boolean;
  progress: number;
  hasTriggeredOptimization: boolean;
}

export const OptimizationProgress: React.FC<OptimizationProgressProps> = ({
  queueSize,
  uniqueSKUCount,
  isOptimizing,
  progress,
  hasTriggeredOptimization
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Optimization Progress</h3>
        <span className="text-sm text-gray-500">
          {queueSize} items in queue ({uniqueSKUCount} unique SKUs)
        </span>
      </div>
      
      {isOptimizing && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
      
      {!isOptimizing && hasTriggeredOptimization && (
        <div className="text-sm text-green-600">
          Optimization completed successfully!
        </div>
      )}
    </div>
  );
}; 