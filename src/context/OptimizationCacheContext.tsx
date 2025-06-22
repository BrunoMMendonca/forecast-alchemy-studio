import React, { createContext, useContext, useState } from 'react';
import { useOptimizationCache } from '@/hooks/useOptimizationCache';

interface OptimizationCacheContextType extends ReturnType<typeof useOptimizationCache> {
  isLoading: boolean;
}

const OptimizationCacheContext = createContext<OptimizationCacheContextType | null>(null);

export const OptimizationCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const cache = useOptimizationCache();

  return (
    <OptimizationCacheContext.Provider value={{ ...cache, isLoading }}>
      {children}
    </OptimizationCacheContext.Provider>
  );
};

export const useOptimizationCacheContext = () => {
  const ctx = useContext(OptimizationCacheContext);
  if (!ctx) throw new Error('useOptimizationCacheContext must be used within OptimizationCacheProvider');
  return ctx;
}; 