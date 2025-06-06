
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';

export const getBusinessContext = (): BusinessContext => {
  // For now, return the default business context
  // This can be extended later to load from user preferences or settings
  return DEFAULT_BUSINESS_CONTEXT;
};
