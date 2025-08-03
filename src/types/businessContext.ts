
export interface BusinessContext {
  costOfError: 'low' | 'medium' | 'high';
  planningPurpose: 'operational' | 'tactical' | 'strategic';
  updateFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interpretabilityNeeds: 'low' | 'medium' | 'high';
}

export const DEFAULT_BUSINESS_CONTEXT: BusinessContext = {
  costOfError: 'medium',
  planningPurpose: 'tactical',
  updateFrequency: 'weekly',
  interpretabilityNeeds: 'medium'
};

export const BUSINESS_CONTEXT_OPTIONS = {
  costOfError: [
    { value: 'low' as const, label: 'Low', description: 'Minor impact from forecast errors' },
    { value: 'medium' as const, label: 'Medium', description: 'Moderate impact from forecast errors' },
    { value: 'high' as const, label: 'High', description: 'Significant impact from forecast errors' }
  ],
  planningPurpose: [
    { value: 'operational' as const, label: 'Operational', description: 'Day-to-day operations (1-3 months)' },
    { value: 'tactical' as const, label: 'Tactical', description: 'Medium-term planning (3-12 months)' },
    { value: 'strategic' as const, label: 'Strategic', description: 'Long-term strategy (12+ months)' }
  ],
  updateFrequency: [
    { value: 'daily' as const, label: 'Daily', description: 'Model updated daily' },
    { value: 'weekly' as const, label: 'Weekly', description: 'Model updated weekly' },
    { value: 'monthly' as const, label: 'Monthly', description: 'Model updated monthly' },
    { value: 'quarterly' as const, label: 'Quarterly', description: 'Model updated quarterly' },
    { value: 'yearly' as const, label: 'Yearly', description: 'Model updated yearly' }
  ],
  interpretabilityNeeds: [
    { value: 'low' as const, label: 'Low', description: 'Focus on accuracy over explainability' },
    { value: 'medium' as const, label: 'Medium', description: 'Balance accuracy and explainability' },
    { value: 'high' as const, label: 'High', description: 'Prioritize simple, explainable models' }
  ]
};
