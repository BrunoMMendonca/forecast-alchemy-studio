import React from 'react';
import { ModelConfig, SalesData } from '@/types/forecast';
import { ParameterControlContainer } from './ParameterControlContainer';

interface ParameterControlProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  disabled?: boolean;
  aiForecastModelOptimizationEnabled?: boolean;
}

export const ParameterControl: React.FC<ParameterControlProps> = (props) => {
  // Add safety check for selectedSKU
  if (!props.selectedSKU) {
    return null;
  }

  return <ParameterControlContainer {...props} />;
};
