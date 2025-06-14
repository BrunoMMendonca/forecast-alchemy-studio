import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, X, Zap, Play } from 'lucide-react';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { OptimizationProgress } from './OptimizationProgress';
import { OptimizationQueue } from '@/types/optimization';

interface OptimizationQueuePopupProps {
  queue: OptimizationQueue;
  models: Array<{
    id: string;
    name: string;
    enabled: boolean;
  }>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveFromQueue: (skus: string[]) => void;
}

export function OptimizationQueuePopup({
  queue,
  models,
  isOpen,
  onOpenChange,
  onRemoveFromQueue
}: OptimizationQueuePopupProps) {
  const queuedSKUs = Array.from(new Set(queue.items.map(item => item.sku)));
  const queuedCombinations = queue.items.map(item => ({ sku: item.sku, modelId: item.modelId }));
  
  // Get the actual optimizable models from default config
  const defaultModels = getDefaultModels();
  const optimizableModels = defaultModels.filter(hasOptimizableParameters);

  // Don't render if there's nothing to show
  if (queuedCombinations.length === 0 && !queue.isOptimizing) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {queue.isOptimizing ? (
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
          <OptimizationProgress
            queueSize={queue.items.length}
            uniqueSKUCount={new Set(queue.items.map(item => item.sku)).size}
            isOptimizing={queue.isOptimizing}
            progress={0}
            hasTriggeredOptimization={false}
          />

          {/* Show message when not optimizing but should be */}
          {!queue.isOptimizing && queuedCombinations.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">Optimization Not Running</span>
              </div>
              <p className="text-sm text-amber-700">
                {queuedCombinations.length} combinations are queued but optimization hasn't started yet.
              </p>
            </div>
          )}

          <div>
            <h3 className="font-medium mb-2">Models for Optimization</h3>
            <div className="flex flex-wrap gap-2">
              {optimizableModels.map(model => (
                <Badge key={model.id} variant="outline">
                  {model.name}
                </Badge>
              ))}
            </div>
            {optimizableModels.length === 0 && (
              <p className="text-sm text-muted-foreground">No optimizable models found</p>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">
              SKUs in Queue ({queuedSKUs.length})
            </h3>
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-4 space-y-3">
                {queuedSKUs.map((sku, index) => {
                  const modelsForSKU = queue.items
                    .filter(item => item.sku === sku)
                    .map(item => item.modelId);
                  const isCurrentlyOptimizing = queue.isOptimizing && queue.progress[sku] !== undefined;
                  
                  return (
                    <div
                      key={`${sku}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isCurrentlyOptimizing
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-mono text-sm font-medium">{sku}</div>
                        <div className="text-xs text-muted-foreground">
                          {modelsForSKU.length} model{modelsForSKU.length !== 1 ? 's' : ''} queued: {modelsForSKU.join(', ')}
                        </div>
                        {/* Show individual model pairs for this SKU */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {queue.items
                            .filter(item => item.sku === sku)
                            .map((item, idx) => {
                              const model = optimizableModels.find(m => m.id === item.modelId);
                              const modelName = model?.name || item.modelId;
                              return (
                                <Badge
                                  key={`${sku}-${item.modelId}-${item.timestamp}-${idx}`}
                                  variant="outline"
                                  className={`text-xs ${
                                    isCurrentlyOptimizing
                                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                                      : 'bg-gray-100'
                                  }`}
                                >
                                  {modelName}
                                </Badge>
                              );
                            })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentlyOptimizing && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveFromQueue([sku])}
                          disabled={queue.isOptimizing}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total combinations: {queuedSKUs.length} SKUs × {optimizableModels.length} models = {queue.items.length}
            </p>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
