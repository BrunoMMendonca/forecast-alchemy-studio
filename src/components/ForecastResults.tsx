
import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ForecastResult } from '@/types/sales';
import { ModelConfig } from '@/types/forecast';
import { ModelAccuracyCards } from './ModelAccuracyCards';
import { ForecastChart } from './ForecastChart';

interface ForecastResultsProps {
  results: ForecastResult[];
  selectedSKU: string;
  enabledModels?: ModelConfig[];
}

export const ForecastResults: React.FC<ForecastResultsProps> = ({ 
  results, 
  selectedSKU, 
  enabledModels 
}) => {
  // Filter results by currently enabled models
  const filteredResults = useMemo(() => {
    if (!enabledModels) return results;
    
    const enabledModelNames = enabledModels
      .filter(m => m.enabled)
      .map(m => m.name);
    
    const filtered = results.filter(r => 
      r.sku === selectedSKU && enabledModelNames.includes(r.model)
    );
    
    console.log(`🎯 ForecastResults: Filtering ${results.length} results by ${enabledModelNames.length} enabled models`);
    console.log(`📊 Enabled models:`, enabledModelNames);
    console.log(`✅ Filtered to ${filtered.length} results for ${selectedSKU}`);
    
    return filtered;
  }, [results, selectedSKU, enabledModels]);

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p>No forecast results yet.</p>
        <p className="text-sm">Generate forecasts to see predictions here.</p>
      </div>
    );
  }

  if (filteredResults.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p>No enabled models for {selectedSKU}.</p>
        <p className="text-sm">Enable models on the left to see forecasts here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModelAccuracyCards results={filteredResults} selectedSKU={selectedSKU} />

      <ForecastChart
        historicalData={[]}
        forecastResults={filteredResults}
        selectedSKU={selectedSKU}
      />
    </div>
  );
};
