
import React from 'react';
import { ReasoningDisplay } from './ReasoningDisplay';

interface OptimizationData {
  confidence?: number;
  
  reasoning?: any;
  factors?: any;
  method?: string;
}

interface ParameterStatusDisplayProps {
  canOptimize: boolean;
  isManual: boolean;
  optimizationData: OptimizationData | null;
  hasOptimizationResults: boolean;
  localSelectedMethod: 'ai' | 'grid' | 'manual' | undefined;
}

export const ParameterStatusDisplay: React.FC<ParameterStatusDisplayProps> = ({
  canOptimize,
  isManual,
  optimizationData,
  hasOptimizationResults,
  localSelectedMethod,
}) => {
  return (
    <>
      {/* Optimization Status Summary - only for optimizable models */}
      {canOptimize && optimizationData && !isManual && (
        <div className="mt-2 flex items-center space-x-4 text-sm">
          <span className="text-slate-600">
            Confidence: <span className="font-medium">{optimizationData.confidence?.toFixed(1)}%</span>
          </span>

        </div>
      )}

      {/* Reasoning Display - Only show if optimization results exist */}
      {hasOptimizationResults && optimizationData?.reasoning && (
        <div className="mt-6 pt-4 border-t">
          <ReasoningDisplay
            reasoning={optimizationData.reasoning}
            factors={optimizationData.factors}
            method={optimizationData.method || 'unknown'}
            confidence={optimizationData.confidence || 0}
          />
        </div>
      )}

      {/* Information for non-optimizable models */}
      {!canOptimize && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            This model uses a fixed algorithm and doesn't require parameter optimization.
          </p>
        </div>
      )}

      {/* Manual mode indicator */}
      {canOptimize && isManual && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">
            Manual mode: You can adjust parameters using the sliders above.
          </p>
        </div>
      )}

      {/* Status indicator when no optimization results are loaded */}
      {canOptimize && !isManual && !optimizationData && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-700">
            No {localSelectedMethod === 'ai' ? 'AI' : 'Grid'} optimization results are currently loaded for this model. 
            If optimization has been run, try refreshing or check if results are available for this SKU.
          </p>
        </div>
      )}
    </>
  );
};
