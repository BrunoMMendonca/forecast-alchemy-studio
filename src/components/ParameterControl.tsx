
import React from 'react';
import { ModelConfig } from '@/types/forecast';
import { SalesData } from '@/pages/Index';
import { ParameterControlContainer } from './ParameterControlContainer';

interface ParameterControlProps {
  model: ModelConfig;
  selectedSKU: string;
  data: SalesData[];
  onParameterUpdate: (parameter: string, value: number) => void;
  onResetToManual: () => void;
  onMethodSelection?: (method: 'ai' | 'grid' | 'manual') => void;
  disabled?: boolean;
  grokApiEnabled?: boolean;
}

export const ParameterControl: React.FC<ParameterControlProps> = (props) => {
  // Add safety check for selectedSKU
  if (!props.selectedSKU || props.selectedSKU === '') {
    console.log('ParameterControl: No valid selectedSKU provided:', props.selectedSKU);
    return null;
  }

  return <ParameterControlContainer {...props} />;
};
