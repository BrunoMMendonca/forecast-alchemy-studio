import React, { createContext, useContext } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

const OptimizationCacheContext = createContext<ReturnType<typeof useOptimizationCache> | null>(null);

export const OptimizationCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cache = useOptimizationCache();
  return (
    <OptimizationCacheContext.Provider value={cache}>
      {children}
    </OptimizationCacheContext.Provider>
  );
};

export const useOptimizationCacheContext = () => {
  const ctx = useContext(OptimizationCacheContext);
  if (!ctx) throw new Error('useOptimizationCacheContext must be used within OptimizationCacheProvider');
  return ctx;
}; 