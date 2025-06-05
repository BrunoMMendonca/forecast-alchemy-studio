
export interface BusinessContext {
  costOfError: 'low' | 'medium' | 'high';
  forecastHorizon: 'short' | 'medium' | 'long';
  updateFrequency: 'daily' | 'weekly' | 'monthly';
  interpretabilityNeeds: 'low' | 'medium' | 'high';
}

export const DEFAULT_BUSINESS_CONTEXT: BusinessContext = {
  costOfError: 'medium',
  forecastHorizon: 'medium',
  updateFrequency: 'weekly',
  interpretabilityNeeds: 'medium'
};

export const BUSINESS_CONTEXT_OPTIONS = {
  costOfError: [
    { value: 'low' as const, label: 'Low', description: 'Minor impact from forecast errors' },
    { value: 'medium' as const, label: 'Medium', description: 'Moderate impact from forecast errors' },
    { value: 'high' as const, label: 'High', description: 'Significant impact from forecast errors' }
  ],
  forecastHorizon: [
    { value: 'short' as const, label: 'Short Term', description: '1-3 months ahead' },
    { value: 'medium' as const, label: 'Medium Term', description: '3-12 months ahead' },
    { value: 'long' as const, label: 'Long Term', description: '12+ months ahead' }
  ],
  updateFrequency: [
    { value: 'daily' as const, label: 'Daily', description: 'Model updated daily' },
    { value: 'weekly' as const, label: 'Weekly', description: 'Model updated weekly' },
    { value: 'monthly' as const, label: 'Monthly', description: 'Model updated monthly' }
  ],
  interpretabilityNeeds: [
    { value: 'low' as const, label: 'Low', description: 'Focus on accuracy over explainability' },
    { value: 'medium' as const, label: 'Medium', description: 'Balance accuracy and explainability' },
    { value: 'high' as const, label: 'High', description: 'Prioritize simple, explainable models' }
  ]
};
