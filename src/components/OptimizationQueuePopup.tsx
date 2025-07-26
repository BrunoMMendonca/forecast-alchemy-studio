import React from 'react';
import { OptimizationQueue } from './OptimizationQueue';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';

interface OptimizationQueuePopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentDataset?: {
    datasetId?: number;
    filename?: string;
    name?: string;
  } | null;
  selectedSKU?: string | null;
  skuCount?: number;
  datasetCount?: number;
}

export const OptimizationQueuePopup: React.FC<OptimizationQueuePopupProps> = ({
  isOpen,
  onOpenChange,
  currentDataset,
  selectedSKU,
  skuCount,
  datasetCount,
}) => {
  // Removed status indicator rendering
  return (
    <OptimizationQueue 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      datasetId={currentDataset?.datasetId}
    />
  );
}; 