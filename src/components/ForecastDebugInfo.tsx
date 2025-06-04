
import React from 'react';

interface ForecastDebugInfoProps {
  navigationState: any;
  getTriggerCount: () => number;
  cacheStats: { hits: number; misses: number };
  isTogglingAIManual: boolean;
  lastSKU: string;
}

export const ForecastDebugInfo: React.FC<ForecastDebugInfoProps> = ({
  navigationState,
  getTriggerCount,
  cacheStats,
  isTogglingAIManual,
  lastSKU
}) => {
  if (!navigationState) return null;

  return (
    <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
      Navigation Optimization: {navigationState.optimizationCompleted ? '✅ Complete' : '⏳ Pending'} 
      | Trigger Count: {getTriggerCount()} 
      | Cache: {cacheStats.hits} hits, {cacheStats.misses} misses
      | Fingerprint: {navigationState.datasetFingerprint}
      | AI/Manual Toggle: {isTogglingAIManual ? '🔄 Active' : '✅ Idle'}
      | Last SKU: {lastSKU}
    </div>
  );
};
