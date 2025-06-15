import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Clock, Target, Zap, X, AlertTriangle } from 'lucide-react';
import { optimizationLogger, OptimizationLog, OptimizationStep } from '@/utils/optimizationLogger';

const getStepIcon = (step: OptimizationStep['step']) => {
  switch (step) {
    case 'start': return '🚀';
    case 'ai_attempt': return '🤖';
    case 'ai_success': return '✅';
    case 'ai_rejected': return '❌';
    case 'grid': return '🔍';
    case 'validation': return '🧪';
    case 'complete': return '🎯';
    case 'error': return '⚠️';
    default: return '📝';
  }
};

const getStepBadgeVariant = (step: OptimizationStep['step']) => {
  switch (step) {
    case 'ai_success': 
    case 'complete': 
      return 'default';
    case 'ai_rejected': 
    case 'error': 
      return 'destructive';
    case 'ai_attempt': 
    case 'grid': 
    case 'validation': 
      return 'secondary';
    default: 
      return 'outline';
  }
};

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const formatDuration = (startTime: number, endTime?: number): string => {
  const duration = (endTime || Date.now()) - startTime;
  return `${(duration / 1000).toFixed(1)}s`;
};

interface OptimizationLoggerProps {
  isVisible: boolean;
  onClose: () => void;
}

export const OptimizationLogger: React.FC<OptimizationLoggerProps> = ({ isVisible, onClose }) => {
  const [log, setLog] = useState<OptimizationLog | null>(null);
  const [expandedSKUs, setExpandedSKUs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = optimizationLogger.subscribe((newLog) => {
      setLog({ ...newLog });
    });

    // Get current log if any
    const currentLog = optimizationLogger.getCurrentLog();
    if (currentLog) {
      setLog({ ...currentLog });
    }

    return unsubscribe;
  }, []);

  if (!isVisible || !log) return null;

  // Group steps by SKU
  const stepsBySKU = log.steps.reduce((acc, step) => {
    if (!acc[step.sku]) {
      acc[step.sku] = [];
    }
    acc[step.sku].push(step);
    return acc;
  }, {} as Record<string, OptimizationStep[]>);

  const toggleSKU = (sku: string) => {
    const newExpanded = new Set(expandedSKUs);
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku);
    } else {
      newExpanded.add(sku);
    }
    setExpandedSKUs(newExpanded);
  };

  return (
    <Card className="fixed top-4 right-4 w-96 max-h-[80vh] z-50 shadow-lg border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Optimization Log
          </CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            <span>🤖 AI: {log.summary.aiOptimized}</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            <span>🔍 Grid: {log.summary.gridOptimized}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>❌ Rejected: {log.summary.aiRejected}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(log.startTime)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4">
          <div className="space-y-2 pb-4">
            {Object.entries(stepsBySKU).map(([sku, steps]) => (
              <Collapsible key={sku} open={expandedSKUs.has(sku)} onOpenChange={() => toggleSKU(sku)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left bg-gray-50 hover:bg-gray-100 rounded text-sm">
                  <span className="font-medium">{sku} ({steps.length} steps)</span>
                  {expandedSKUs.has(sku) ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-start gap-2 p-2 text-xs border-l-2 border-gray-200">
                      <span className="text-base leading-none">{getStepIcon(step.step)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getStepBadgeVariant(step.step)} className="text-xs px-1 py-0">
                            {step.modelId}
                          </Badge>
                          <span className="text-gray-500">{formatTimestamp(step.timestamp)}</span>
                        </div>
                        <p className="text-gray-700 break-words">{step.message}</p>
                        
                        {step.parameters && (
                          <div className="mt-1 text-gray-600">
                            <strong>Params:</strong> {JSON.stringify(step.parameters)}
                          </div>
                        )}
                        
                        {step.accuracy !== undefined && (
                          <div className="mt-1 text-gray-600">
                            <strong>Accuracy:</strong> {step.accuracy.toFixed(1)}%
                            {step.confidence && ` (confidence: ${step.confidence.toFixed(1)}%)`}
                          </div>
                        )}
                        
                        {step.error && (
                          <div className="mt-1 text-red-600 text-xs">
                            <strong>Error:</strong> {step.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
