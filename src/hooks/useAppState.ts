import { useState } from 'react';
import { NormalizedSalesData, ForecastResult } from '@/types/forecast';

export const useAppState = () => {
  const [salesData, setSalesData] = useState<NormalizedSalesData[]>([]);
  const [cleanedData, setCleanedData] = useState<NormalizedSalesData[]>([]);
  const [forecastResults, setForecastResults] = useState<ForecastResult[]>([]);
  const [selectedSKUForResults, setSelectedSKUForResults] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isQueuePopupOpen, setIsQueuePopupOpen] = useState(false);

  return {
    salesData,
    setSalesData,
    cleanedData,
    setCleanedData,
    forecastResults,
    setForecastResults,
    selectedSKUForResults,
    setSelectedSKUForResults,
    currentStep,
    setCurrentStep,
    settingsOpen,
    setSettingsOpen,
    isQueuePopupOpen,
    setIsQueuePopupOpen
  };
};
