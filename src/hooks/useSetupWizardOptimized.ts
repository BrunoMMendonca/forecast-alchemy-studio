import { useEffect } from 'react';
import { useSetupWizardStore } from '../store/setupWizardStore';

/**
 * Optimized hook for loading setup wizard data with caching and parallel loading
 */
export const useSetupWizardOptimized = () => {
  const {
    loadSetupData,
    loadOrgData,
    isCacheStale,
    clearCache,
    isLoading,
    company,
    divisions,
    clusters,
    setupStatus
  } = useSetupWizardStore();

  // Load setup data on mount
  useEffect(() => {
    loadSetupData();
  }, [loadSetupData]);

  // Load org data when needed
  useEffect(() => {
    if (setupStatus && !company) {
      loadOrgData();
    }
  }, [setupStatus, company, loadOrgData]);

  // Force refresh function
  const refreshData = () => {
    clearCache();
    loadSetupData();
    if (setupStatus) {
      loadOrgData();
    }
  };

  return {
    isLoading,
    company,
    divisions,
    clusters,
    setupStatus,
    refreshData,
    isDataStale: (key: string) => isCacheStale(key)
  };
}; 
 
 
 
 
 
 
 
 
 