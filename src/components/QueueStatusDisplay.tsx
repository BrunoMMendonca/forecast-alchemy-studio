
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Zap, Eye } from 'lucide-react';

interface QueueStatusDisplayProps {
  optimizationQueue: {
    getSKUsInQueue: () => string[];
    removeSKUsFromQueue: (skus: string[]) => void;
    queueSize: number;
    uniqueSKUCount: number;
  };
  isOptimizing: boolean;
  progress?: {
    currentSKU?: string;
    completedSKUs: number;
    totalSKUs: number;
  } | null;
  hasTriggeredOptimization: boolean;
  onOpenQueuePopup?: () => void;
}

export const QueueStatusDisplay: React.FC<QueueStatusDisplayProps> = ({
  optimizationQueue,
  isOptimizing,
  progress,
  hasTriggeredOptimization,
  onOpenQueuePopup,
}) => {
  const queuedSKUs = optimizationQueue.getSKUsInQueue();
  const shouldShow = isOptimizing || optimizationQueue.queueSize > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`border rounded-lg p-4 ${
      isOptimizing 
        ? 'bg-blue-50 border-blue-200' 
        : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isOptimizing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">
                Currently optimizing: {progress?.currentSKU || 'Processing...'}
              </span>
              <Badge variant="secondary" className="text-xs">
                {progress ? `${progress.completedSKUs + 1}/${progress.totalSKUs}` : 'Processing...'}
              </Badge>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                {optimizationQueue.queueSize} combinations queued ({optimizationQueue.uniqueSKUCount} SKUs)
              </span>
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                {hasTriggeredOptimization ? 'Starting...' : 'Pending'}
              </Badge>
            </>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenQueuePopup}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          View Details
        </Button>
      </div>
    </div>
  );
};
