
import React from 'react';
import { BatchOptimizationProgress } from '@/types/batchOptimization';

interface OptimizationProgressProps {
  isOptimizing: boolean;
  progress: BatchOptimizationProgress | null;
  optimizationCompleted: boolean;
  showOptimizationLog: boolean;
  onToggleLog: () => void;
  onClearProgress: () => void;
}

export const OptimizationProgress: React.FC<OptimizationProgressProps> = ({
  isOptimizing,
  progress,
  optimizationCompleted,
  showOptimizationLog,
  onToggleLog,
  onClearProgress
}) => {
  if (!progress && !isOptimizing && !optimizationCompleted) return null;

  return (
    <div className={`border rounded-lg p-4 ${optimizationCompleted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isOptimizing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          ) : (
            <div className="rounded-full h-4 w-4 bg-green-600 flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          )}
          <span className={`text-sm font-medium ${optimizationCompleted ? 'text-green-800' : 'text-blue-800'}`}>
            {isOptimizing ? 'Enhanced AI Optimization in Progress...' : 'Enhanced Optimization Complete!'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLog}
            className={`text-xs px-2 py-1 rounded ${
              optimizationCompleted 
                ? 'bg-green-100 hover:bg-green-200 text-green-700'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
            }`}
          >
            {showOptimizationLog ? 'Hide' : 'Show'} Log
          </button>
          {optimizationCompleted && (
            <button
              onClick={onClearProgress}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
      
      {isOptimizing && progress ? (
        <>
          <p className="text-sm text-blue-600 mb-2">
            Processing {progress.currentSKU} - {progress.currentModel} ({progress.completedSKUs + 1}/{progress.totalSKUs})
          </p>
          <div className="mt-2 bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((progress.completedSKUs) / progress.totalSKUs) * 100}%` }}
            />
          </div>
        </>
      ) : progress ? (
        <div>
          <p className="text-sm text-green-600 mb-2">
            Successfully processed {progress.totalSKUs} SKU{progress.totalSKUs > 1 ? 's' : ''}
          </p>
          {progress.aiOptimized > 0 && (
            <p className="text-xs text-green-500 mb-1">
              AI Acceptance Rate: {((progress.aiOptimized / (progress.aiOptimized + progress.aiRejected)) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      ) : null}
      
      {progress && (
        <div className={`grid grid-cols-2 gap-2 text-xs ${optimizationCompleted ? 'text-green-600' : 'text-blue-500'}`}>
          <div>🤖 AI Optimized: {progress.aiOptimized || 0}</div>
          <div>🔍 Grid Optimized: {progress.gridOptimized || 0}</div>
          <div>❌ AI Rejected: {progress.aiRejected || 0}</div>
          <div>📋 From Cache: {progress.skipped || 0}</div>
          {progress.aiAcceptedByTolerance > 0 && (
            <div className="col-span-2 text-xs text-blue-600">
              ✅ AI by Tolerance: {progress.aiAcceptedByTolerance} | by Confidence: {progress.aiAcceptedByConfidence || 0}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
