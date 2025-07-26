import { saveSettings, getSettings } from '@/services/settingsProvider';
import { useState, useCallback, useEffect, useRef } from 'react';
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';
import { GlobalSettings } from '@/types/globalSettings';
import { useAISettings } from './useAISettings';

const GLOBAL_SETTINGS_KEY = 'global_settings';

const DEFAULT_SETTINGS: GlobalSettings = {
  forecastPeriods: 12,
  businessContext: DEFAULT_BUSINESS_CONTEXT,
  aiForecastModelOptimizationEnabled: false,
  aiCsvImportEnabled: true,
  aiFailureThreshold: 5,
  largeFileProcessingEnabled: true,
  largeFileThreshold: 1024 * 1024, // 1MB default
  aiReasoningEnabled: false,
  mapeWeight: 40,
  rmseWeight: 30,
  maeWeight: 20,
  accuracyWeight: 10,
  
  frequency: 'monthly',
  autoDetectFrequency: true,
  csvSeparator: ',',
};

interface UseGlobalSettingsProps {
  onSettingsChange?: (changedSetting: keyof GlobalSettings) => void;
}

export const useGlobalSettings = (props?: UseGlobalSettingsProps) => {
  const [forecastPeriods, setForecastPeriodsState] = useState<number>(DEFAULT_SETTINGS.forecastPeriods);
  const [businessContext, setBusinessContextState] = useState<BusinessContext>(DEFAULT_SETTINGS.businessContext);
  const [aiForecastModelOptimizationEnabled, setaiForecastModelOptimizationEnabledState] = useState<boolean>(DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
  const [aiCsvImportEnabled, setAiCsvImportEnabledState] = useState<boolean>(DEFAULT_SETTINGS.aiCsvImportEnabled);
  const [aiFailureThreshold, setAiFailureThresholdState] = useState<number>(DEFAULT_SETTINGS.aiFailureThreshold);
  const [largeFileProcessingEnabled, setLargeFileProcessingEnabledState] = useState<boolean>(DEFAULT_SETTINGS.largeFileProcessingEnabled);
  const [largeFileThreshold, setLargeFileThresholdState] = useState<number>(DEFAULT_SETTINGS.largeFileThreshold);
  const [aiReasoningEnabled, setAiReasoningEnabledState] = useState<boolean>(DEFAULT_SETTINGS.aiReasoningEnabled);
  const [mapeWeight, setMapeWeightState] = useState<number>(DEFAULT_SETTINGS.mapeWeight);
  const [rmseWeight, setRmseWeightState] = useState<number>(DEFAULT_SETTINGS.rmseWeight);
  const [maeWeight, setMaeWeightState] = useState<number>(DEFAULT_SETTINGS.maeWeight);
  const [accuracyWeight, setAccuracyWeightState] = useState<number>(DEFAULT_SETTINGS.accuracyWeight);
  
  const [frequency, setFrequencyState] = useState<string | undefined>(DEFAULT_SETTINGS.frequency);
  const [autoDetectFrequency, setAutoDetectFrequencyState] = useState<boolean | undefined>(DEFAULT_SETTINGS.autoDetectFrequency);
  const [csvSeparator, setCsvSeparatorState] = useState<string>(DEFAULT_SETTINGS.csvSeparator!);

  // Initialize AI settings
  const { enabled: aiEnabled } = useAISettings();

  // Load settings from localStorage on mount
  useEffect(() => {
    async function fetchAndSyncSettings() {
      try {
        const settings = await getSettings();
        setForecastPeriodsState(settings.forecastPeriods);
        setBusinessContextState(settings.businessContext);
        setaiForecastModelOptimizationEnabledState(settings.aiForecastModelOptimizationEnabled);
        setAiCsvImportEnabledState(settings.aiCsvImportEnabled);
        setAiFailureThresholdState(settings.aiFailureThreshold);
        setLargeFileProcessingEnabledState(settings.largeFileProcessingEnabled);
        setLargeFileThresholdState(settings.largeFileThreshold);
        setAiReasoningEnabledState(settings.aiReasoningEnabled);
        setMapeWeightState(settings.mapeWeight);
        setRmseWeightState(settings.rmseWeight);
        setMaeWeightState(settings.maeWeight);
        
        setFrequencyState(settings.frequency);
        setAutoDetectFrequencyState(settings.autoDetectFrequency);
        setCsvSeparatorState(settings.csvSeparator);
      } catch (error) {
        // Silent error handling
      }
    }
    fetchAndSyncSettings();
  }, []);

  // Listen for localStorage changes from other hook instances
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === GLOBAL_SETTINGS_KEY && event.newValue) {
        try {
          const settings: GlobalSettings = JSON.parse(event.newValue);
          setForecastPeriodsState(settings.forecastPeriods || DEFAULT_SETTINGS.forecastPeriods);
          setBusinessContextState(settings.businessContext || DEFAULT_SETTINGS.businessContext);
          setaiForecastModelOptimizationEnabledState(settings.aiForecastModelOptimizationEnabled ?? DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
          setAiCsvImportEnabledState(settings.aiCsvImportEnabled ?? DEFAULT_SETTINGS.aiCsvImportEnabled);
          setAiFailureThresholdState(settings.aiFailureThreshold ?? DEFAULT_SETTINGS.aiFailureThreshold);
          setLargeFileProcessingEnabledState(settings.largeFileProcessingEnabled ?? DEFAULT_SETTINGS.largeFileProcessingEnabled);
          setLargeFileThresholdState(settings.largeFileThreshold ?? DEFAULT_SETTINGS.largeFileThreshold);
          setAiReasoningEnabledState(settings.aiReasoningEnabled ?? DEFAULT_SETTINGS.aiReasoningEnabled);
          setMapeWeightState(settings.mapeWeight ?? DEFAULT_SETTINGS.mapeWeight);
          setRmseWeightState(settings.rmseWeight ?? DEFAULT_SETTINGS.rmseWeight);
          setMaeWeightState(settings.maeWeight ?? DEFAULT_SETTINGS.maeWeight);
          setAccuracyWeightState(settings.accuracyWeight ?? DEFAULT_SETTINGS.accuracyWeight);
          setFrequencyState(settings.frequency);
          setAutoDetectFrequencyState(settings.autoDetectFrequency);
          setCsvSeparatorState(settings.csvSeparator ?? DEFAULT_SETTINGS.csvSeparator!);
        } catch (error) {
          // Silent error handling
        }
      }
    };

    // Listen for storage changes from other tabs/components
    window.addEventListener('storage', handleStorageChange);

    // Custom event for same-tab localStorage changes
    const handleCustomStorageChange = (event: CustomEvent) => {
      if (event.detail.key === GLOBAL_SETTINGS_KEY) {
        try {
          const settings: GlobalSettings = JSON.parse(event.detail.newValue);
          setForecastPeriodsState(settings.forecastPeriods || DEFAULT_SETTINGS.forecastPeriods);
          setBusinessContextState(settings.businessContext || DEFAULT_SETTINGS.businessContext);
          setaiForecastModelOptimizationEnabledState(settings.aiForecastModelOptimizationEnabled ?? DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
          setAiCsvImportEnabledState(settings.aiCsvImportEnabled ?? DEFAULT_SETTINGS.aiCsvImportEnabled);
          setAiFailureThresholdState(settings.aiFailureThreshold ?? DEFAULT_SETTINGS.aiFailureThreshold);
          setLargeFileProcessingEnabledState(settings.largeFileProcessingEnabled ?? DEFAULT_SETTINGS.largeFileProcessingEnabled);
          setLargeFileThresholdState(settings.largeFileThreshold ?? DEFAULT_SETTINGS.largeFileThreshold);
          setAiReasoningEnabledState(settings.aiReasoningEnabled ?? DEFAULT_SETTINGS.aiReasoningEnabled);
          setMapeWeightState(settings.mapeWeight ?? DEFAULT_SETTINGS.mapeWeight);
          setRmseWeightState(settings.rmseWeight ?? DEFAULT_SETTINGS.rmseWeight);
          setMaeWeightState(settings.maeWeight ?? DEFAULT_SETTINGS.maeWeight);
          setAccuracyWeightState(settings.accuracyWeight ?? DEFAULT_SETTINGS.accuracyWeight);
          setFrequencyState(settings.frequency);
          setAutoDetectFrequencyState(settings.autoDetectFrequency);
          setCsvSeparatorState(settings.csvSeparator ?? DEFAULT_SETTINGS.csvSeparator!);
        } catch (error) {
          // Silent error handling
        }
      }
    };

    window.addEventListener('localStorageChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange);
    };
  }, []);


  const onSettingsChangeRef = useRef<UseGlobalSettingsProps['onSettingsChange']>(props?.onSettingsChange);

  // Allow dynamic assignment of the handler
  const setOnSettingsChange = useCallback((handler: UseGlobalSettingsProps['onSettingsChange']) => {
    onSettingsChangeRef.current = handler;
  }, []);

  const setForecastPeriods = useCallback((periods: number) => {
    const oldPeriods = forecastPeriods;
    setForecastPeriodsState(periods);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (oldPeriods !== periods && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('forecastPeriods');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    const oldContext = businessContext;
    setBusinessContextState(context);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (JSON.stringify(oldContext) !== JSON.stringify(context) && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('businessContext');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setaiForecastModelOptimizationEnabled = useCallback((enabled: boolean) => {
    const oldEnabled = aiForecastModelOptimizationEnabled;
    const newEnabled = enabled && aiEnabled;
    setaiForecastModelOptimizationEnabledState(newEnabled);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled: newEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (oldEnabled !== newEnabled && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiForecastModelOptimizationEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, aiEnabled, frequency, autoDetectFrequency, csvSeparator]);

  const setAiCsvImportEnabled = useCallback((enabled: boolean) => {
    setAiCsvImportEnabledState(enabled);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled: enabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiCsvImportEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setAiFailureThreshold = useCallback((threshold: number) => {
    setAiFailureThresholdState(threshold);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold: threshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiFailureThreshold');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setLargeFileProcessingEnabled = useCallback((enabled: boolean) => {
    const oldEnabled = largeFileProcessingEnabled;
    setLargeFileProcessingEnabledState(enabled);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled: enabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (oldEnabled !== enabled && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('largeFileProcessingEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setLargeFileThreshold = useCallback((threshold: number) => {
    const oldThreshold = largeFileThreshold;
    setLargeFileThresholdState(threshold);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold: threshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (oldThreshold !== threshold && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('largeFileThreshold');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setAiReasoningEnabled = useCallback((enabled: boolean) => {
    const oldEnabled = aiReasoningEnabled;
    setAiReasoningEnabledState(enabled);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled: enabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (oldEnabled !== enabled && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiReasoningEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setMapeWeight = useCallback((weight: number) => {
    setMapeWeightState(weight);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight: weight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('mapeWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setRmseWeight = useCallback((weight: number) => {
    setRmseWeightState(weight);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight: weight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('rmseWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setMaeWeight = useCallback((weight: number) => {
    setMaeWeightState(weight);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight: weight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('maeWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const setAccuracyWeight = useCallback((weight: number) => {
    setAccuracyWeightState(weight);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight: weight,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('accuracyWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  // Batch update for all weights
  const setWeights = useCallback((weights: { mape: number; rmse: number; mae: number; accuracy: number }) => {
    setMapeWeightState(weights.mape);
    setRmseWeightState(weights.rmse);
    setMaeWeightState(weights.mae);
    setAccuracyWeightState(weights.accuracy);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight: weights.mape,
      rmseWeight: weights.rmse,
      maeWeight: weights.mae,
      accuracyWeight: weights.accuracy,
      frequency,
      autoDetectFrequency,
      csvSeparator,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('mapeWeight');
      onSettingsChangeRef.current('rmseWeight');
      onSettingsChangeRef.current('maeWeight');
      onSettingsChangeRef.current('accuracyWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, largeFileProcessingEnabled, largeFileThreshold, saveSettings, frequency, autoDetectFrequency, csvSeparator]);

  const resetToDefaults = useCallback(() => {
    setForecastPeriodsState(DEFAULT_SETTINGS.forecastPeriods);
    setBusinessContextState(DEFAULT_SETTINGS.businessContext);
    setaiForecastModelOptimizationEnabledState(DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
    setAiCsvImportEnabledState(DEFAULT_SETTINGS.aiCsvImportEnabled);
    setAiFailureThresholdState(DEFAULT_SETTINGS.aiFailureThreshold);
    setLargeFileProcessingEnabledState(DEFAULT_SETTINGS.largeFileProcessingEnabled);
    setLargeFileThresholdState(DEFAULT_SETTINGS.largeFileThreshold);
    setAiReasoningEnabledState(DEFAULT_SETTINGS.aiReasoningEnabled);
    setMapeWeightState(DEFAULT_SETTINGS.mapeWeight);
    setRmseWeightState(DEFAULT_SETTINGS.rmseWeight);
    setMaeWeightState(DEFAULT_SETTINGS.maeWeight);
    setAccuracyWeightState(DEFAULT_SETTINGS.accuracyWeight);
    setFrequencyState(DEFAULT_SETTINGS.frequency);
    setAutoDetectFrequencyState(DEFAULT_SETTINGS.autoDetectFrequency);
    setCsvSeparatorState(DEFAULT_SETTINGS.csvSeparator!);
    console.log('[useGlobalSettings] About to call saveSettings');
    saveSettings({
      forecastPeriods: DEFAULT_SETTINGS.forecastPeriods,
      businessContext: DEFAULT_SETTINGS.businessContext,
      aiForecastModelOptimizationEnabled: DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled: DEFAULT_SETTINGS.aiCsvImportEnabled,
      aiFailureThreshold: DEFAULT_SETTINGS.aiFailureThreshold,
      largeFileProcessingEnabled: DEFAULT_SETTINGS.largeFileProcessingEnabled,
      largeFileThreshold: DEFAULT_SETTINGS.largeFileThreshold,
      aiReasoningEnabled: DEFAULT_SETTINGS.aiReasoningEnabled,
      mapeWeight: DEFAULT_SETTINGS.mapeWeight,
      rmseWeight: DEFAULT_SETTINGS.rmseWeight,
      maeWeight: DEFAULT_SETTINGS.maeWeight,
      accuracyWeight: DEFAULT_SETTINGS.accuracyWeight,
      frequency: DEFAULT_SETTINGS.frequency,
      autoDetectFrequency: DEFAULT_SETTINGS.autoDetectFrequency,
      csvSeparator: DEFAULT_SETTINGS.csvSeparator!,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('forecastPeriods');
    }
  }, [saveSettings, csvSeparator]);

  const setCsvSeparator = useCallback((sep: string) => {
    setCsvSeparatorState(sep);
    saveSettings({
      forecastPeriods,
      businessContext,
      aiForecastModelOptimizationEnabled,
      aiCsvImportEnabled,
      aiFailureThreshold,
      largeFileProcessingEnabled,
      largeFileThreshold,
      aiReasoningEnabled,
      mapeWeight,
      rmseWeight,
      maeWeight,
      accuracyWeight,
      frequency,
      autoDetectFrequency,
      csvSeparator: sep,
    });
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('csvSeparator');
    }
  }, [
    forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold,
    largeFileProcessingEnabled, largeFileThreshold, aiReasoningEnabled, mapeWeight, rmseWeight, maeWeight,
    frequency, autoDetectFrequency, saveSettings
  ]);

  return {
    forecastPeriods,
    setForecastPeriods,
    businessContext,
    setBusinessContext,
    aiForecastModelOptimizationEnabled,
    setaiForecastModelOptimizationEnabled,
    aiCsvImportEnabled,
    setAiCsvImportEnabled,
    aiFailureThreshold,
    setAiFailureThreshold,
    largeFileProcessingEnabled,
    setLargeFileProcessingEnabled,
    largeFileThreshold,
    setLargeFileThreshold,
    resetToDefaults,
    setOnSettingsChange,
    aiReasoningEnabled,
    setAiReasoningEnabled,
    mapeWeight,
    setMapeWeight,
    rmseWeight,
    setRmseWeight,
    maeWeight,
    setMaeWeight,
    accuracyWeight,
    setAccuracyWeight,
    setWeights,
    frequency,
    setFrequencyState,
    autoDetectFrequency,
    setAutoDetectFrequencyState,
    csvSeparator,
    setCsvSeparator,
  };
};
