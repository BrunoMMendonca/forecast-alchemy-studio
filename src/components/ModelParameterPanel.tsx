
import React, { useMemo } from 'react';
import { ModelConfig } from '@/types/forecast';
import { ParameterControl } from './ParameterControl';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

interface ModelParameterPanelProps {
  model: ModelConfig;
  selectedSKU: string;
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual?: () => void;
  grokApiEnabled?: boolean;
}

export const ModelParameterPanel: React.FC<ModelParameterPanelProps> = ({
  model,
  selectedSKU,
  onParameterUpdate,
  onResetToManual,
  grokApiEnabled = true,
}) => {
  const { cache } = useOptimizationCache();

  // Get the cache entry for this SKU/model combination
  const cacheEntry = useMemo(() => {
    if (!selectedSKU) return null;
    return cache[selectedSKU]?.[model.id] || null;
  }, [cache, selectedSKU, model.id]);

  if (!model.parameters || Object.keys(model.parameters).length === 0) {
    return (
      <div className="text-sm text-slate-500 italic">
        No configurable parameters for this model.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {Object.entries(model.parameters).map(([key, param]) => (
          <ParameterControl
            key={key}
            name={key}
            parameter={param}
            value={param.value}
            onChange={(value) => onParameterUpdate(key, value)}
            selectedSKU={selectedSKU}
            modelId={model.id}
            cacheEntry={cacheEntry}
            onResetToManual={onResetToManual}
            grokApiEnabled={grokApiEnabled}
          />
        ))}
      </div>
    </div>
  );
};
