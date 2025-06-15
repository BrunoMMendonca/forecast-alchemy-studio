import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, X, Zap, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getDefaultModels, hasOptimizableParameters } from '@/utils/modelConfig';
import { OptimizationProgress } from './OptimizationProgress';
import { OptimizationQueue } from '@/types/optimization';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

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
  cleanedData: Array<{ [key: string]: any }>;
  setPaused: (paused: boolean) => void;
  onClearCache: () => void;
}

export function OptimizationQueuePopup({
  queue,
  models,
  isOpen,
  onOpenChange,
  onRemoveFromQueue,
  cleanedData,
  setPaused,
  onClearCache
}: OptimizationQueuePopupProps) {
  const queuedSKUs = Array.from(new Set(queue.items.map(item => item.sku)));
  const queuedCombinations = queue.items.map(item => ({ sku: item.sku, modelId: item.modelId }));
  
  // Get the actual optimizable models from default config
  const defaultModels = getDefaultModels();
  const optimizableModels = defaultModels.filter(hasOptimizableParameters);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl${queue.paused ? ' bg-red-50 border border-red-200' : ''}`}>
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
          <DialogTitle className="flex items-center gap-2">
            {queue.isOptimizing && queue.items.length > 0 ? (
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
            <div className="flex items-center gap-4 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Processing</span>
                <Switch
                  checked={!queue.paused}
                  onCheckedChange={checked => setPaused(!checked)}
                  className={queue.paused ? 'bg-red-300' : ''}
                  aria-label="Toggle queue processing"
                />
              </div>
              <button
                className="text-xs text-red-500 underline cursor-pointer hover:text-red-700"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all optimization cache? This will force all jobs to reprocess.')) {
                    onClearCache();
                  }
                }}
                type="button"
              >
                Clear cache
              </button>
            </div>
          </div>
        </DialogHeader>

        {queue.paused && (
          <div className="bg-red-100 border border-red-300 text-red-700 rounded-lg p-3 mb-2 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="font-medium">Processing is paused. No jobs will be processed until resumed.</span>
          </div>
        )}

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

          {/* Show empty state if queue is empty */}
          {!queue.isOptimizing && queuedCombinations.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-lg font-semibold text-gray-700 mb-2">The queue is currently empty</p>
              <p className="text-sm text-gray-500">Add SKUs and models to the queue to start optimization.</p>
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
              Jobs in Queue ({queue.items.length})
            </h3>
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-4 space-y-3">
                {queue.items.map((item, index) => {
                  const { sku, modelId, method, reason } = item;
                  // Progress info for this SKU/model
                  const skuProgress = queue.progress[sku] || {};
                  const modelProgress = skuProgress[modelId] || { status: 'pending' };
                  const isCurrentlyOptimizing = queue.isOptimizing && modelProgress.status === 'optimizing';
                  // Look up description for this SKU from cleanedData
                  const skuDescription = cleanedData.find(d => d['Material Code'] === sku)?.Description || '';
                  // Look up model name
                  const model = models.find(m => m.id === modelId);
                  const modelName = model?.name || modelId;

                  let statusIcon = null;
                  let statusColor = '';
                  if (modelProgress.status === 'optimizing') {
                    statusIcon = <Loader2 className="animate-spin h-3 w-3 text-blue-600 inline-block ml-1" />;
                    statusColor = 'text-blue-700';
                  } else if (modelProgress.status === 'complete') {
                    statusIcon = <CheckCircle className="h-3 w-3 text-green-600 inline-block ml-1" />;
                    statusColor = 'text-green-700';
                  } else if (modelProgress.status === 'error') {
                    statusIcon = <XCircle className="h-3 w-3 text-red-600 inline-block ml-1" />;
                    statusColor = 'text-red-700';
                  } else {
                    statusIcon = null;
                    statusColor = 'text-gray-600';
                  }

                  return (
                    <div
                      key={`${sku}-${modelId}-${method}-${index}`}
                      className={`flex flex-col gap-2 p-3 rounded-lg border ${
                        isCurrentlyOptimizing
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                        <div className="font-mono text-sm font-medium">
                          {sku}
                          {skuDescription && (
                            <span className="ml-2 text-xs text-gray-500">- {skuDescription}</span>
                          )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Model: {modelName} ({method.toUpperCase()})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Reason: {reason}
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
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs flex items-center gap-1 ${statusColor}`}
                            >
                          {modelProgress.status} {statusIcon}
                              {modelProgress.status === 'error' && modelProgress.error && (
                                <span className="ml-1 text-red-500">{modelProgress.error}</span>
                              )}
                              {typeof modelProgress.progress === 'number' && modelProgress.status === 'optimizing' && (
                                <span className="ml-1">{Math.round(modelProgress.progress * 100)}%</span>
                              )}
                            </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">
                {queue.items.length} jobs in queue ({queuedSKUs.length} unique SKUs)
              </span>
            </div>
            {/* Progress bar: show percent of jobs complete */}
            <Progress value={queue.items.length === 0 ? 0 : Math.round((Object.values(queue.progress).flat().filter(p => p.status === 'complete').length / queue.items.length) * 100)} />
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Total jobs: {queue.items.length}
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
