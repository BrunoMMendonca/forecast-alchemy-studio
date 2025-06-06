
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, X, Zap } from 'lucide-react';

interface OptimizationQueuePopupProps {
  optimizationQueue: {
    getSKUsInQueue: () => string[];
    removeSKUsFromQueue: (skus: string[]) => void;
    removeUnnecessarySKUs: (skus: string[]) => void;
  };
  models: Array<{
    id: string;
    name: string;
    enabled: boolean;
  }>;
  isOptimizing: boolean;
  progress?: {
    currentSKU?: string;
    completedSKUs: number;
    totalSKUs: number;
  } | null;
}

export const OptimizationQueuePopup: React.FC<OptimizationQueuePopupProps> = ({
  optimizationQueue,
  models,
  isOptimizing,
  progress
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open when there are items in queue or optimization is running
  useEffect(() => {
    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length > 0 || isOptimizing) {
      setIsOpen(true);
    }
  }, [optimizationQueue.getSKUsInQueue().length, isOptimizing]);

  // Auto-close when queue is empty and not optimizing
  useEffect(() => {
    const queuedSKUs = optimizationQueue.getSKUsInQueue();
    if (queuedSKUs.length === 0 && !isOptimizing) {
      setTimeout(() => setIsOpen(false), 2000); // Close after 2 seconds
    }
  }, [optimizationQueue.getSKUsInQueue().length, isOptimizing]);

  const queuedSKUs = optimizationQueue.getSKUsInQueue();
  const enabledModels = models.filter(m => m.enabled);

  if (queuedSKUs.length === 0 && !isOptimizing) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOptimizing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <Zap className="h-4 w-4 text-blue-600" />
                Optimization in Progress
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-amber-600" />
                Optimization Queue
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isOptimizing && progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-800">Currently Processing</h3>
                  <p className="text-sm text-blue-600">SKU: {progress.currentSKU}</p>
                </div>
                <Badge variant="secondary">
                  {progress.completedSKUs + 1}/{progress.totalSKUs}
                </Badge>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-medium mb-2">Models to Optimize</h3>
            <div className="flex flex-wrap gap-2">
              {enabledModels.map(model => (
                <Badge key={model.id} variant="outline">
                  {model.name}
                </Badge>
              ))}
            </div>
            {enabledModels.length === 0 && (
              <p className="text-sm text-muted-foreground">No models enabled for optimization</p>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">
              SKUs in Queue ({queuedSKUs.length})
            </h3>
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-4 space-y-3">
                {queuedSKUs.map((sku, index) => (
                  <div
                    key={`${sku}-${index}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOptimizing && progress?.currentSKU === sku
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm font-medium">{sku}</div>
                      <div className="text-xs text-muted-foreground">
                        Queued for optimization
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOptimizing && progress?.currentSKU === sku && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => optimizationQueue.removeSKUsFromQueue([sku])}
                        disabled={isOptimizing}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total combinations: {queuedSKUs.length} SKUs × {enabledModels.length} models = {queuedSKUs.length * enabledModels.length}
            </p>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
