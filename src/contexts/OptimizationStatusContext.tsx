import React, { createContext, useContext, ReactNode } from 'react';
import { useOptimizationStatus } from '@/hooks/useOptimizationStatus';

// Create the context
const OptimizationStatusContext = createContext<ReturnType<typeof useOptimizationStatus> | null>(null);

// Provider component
export const OptimizationStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const optimizationStatus = useOptimizationStatus();
  
  return (
    <OptimizationStatusContext.Provider value={optimizationStatus}>
      {children}
    </OptimizationStatusContext.Provider>
  );
};

// Custom hook to use the context
export const useOptimizationStatusContext = () => {
  const context = useContext(OptimizationStatusContext);
  if (!context) {
    throw new Error('useOptimizationStatusContext must be used within an OptimizationStatusProvider');
  }
  return context;
}; 