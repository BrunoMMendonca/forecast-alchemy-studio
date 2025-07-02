import { useState, useCallback, useEffect, useRef } from 'react';
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';
import { useAISettings } from './useAISettings';

const GLOBAL_SETTINGS_KEY = 'global_settings';

export interface GlobalSettings {
  forecastPeriods: number;
  businessContext: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
  aiCsvImportEnabled: boolean;
  aiFailureThreshold: number;
  largeFileProcessingEnabled: boolean;
  largeFileThreshold: number;
  aiReasoningEnabled: boolean;
  mapeWeight: number;
  rmseWeight: number;
  maeWeight: number;
  accuracyWeight: number;
  frequency: number;
  autoDetectFrequency: boolean;
  csvSeparator: string;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  forecastPeriods: 12,
  businessContext: DEFAULT_BUSINESS_CONTEXT,
  aiForecastModelOptimizationEnabled: false,
  aiCsvImportEnabled: true,
  aiFailureThreshold: 5,
  largeFileProcessingEnabled: false,
  largeFileThreshold: 100,
  aiReasoningEnabled: false,
  mapeWeight: 0.5,
  rmseWeight: 0.3,
  maeWeight: 0.2,
  accuracyWeight: 0.5,
  frequency: 1,
  autoDetectFrequency: false,
  csvSeparator: ','
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
  const [frequency, setFrequencyState] = useState<number>(DEFAULT_SETTINGS.frequency);
  const [autoDetectFrequency, setAutoDetectFrequencyState] = useState<boolean>(DEFAULT_SETTINGS.autoDetectFrequency);
  const [csvSeparator, setCsvSeparatorState] = useState<string>(DEFAULT_SETTINGS.csvSeparator);

  // Initialize AI settings
  const { enabled: aiEnabled } = useAISettings();

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GLOBAL_SETTINGS_KEY);
      if (stored) {
        const settings: GlobalSettings = JSON.parse(stored);
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
        setFrequencyState(settings.frequency ?? DEFAULT_SETTINGS.frequency);
        setAutoDetectFrequencyState(settings.autoDetectFrequency ?? DEFAULT_SETTINGS.autoDetectFrequency);
        setCsvSeparatorState(settings.csvSeparator ?? DEFAULT_SETTINGS.csvSeparator);
      }
    } catch (error) {
      // Silent error handling
    }
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
          setFrequencyState(settings.frequency ?? DEFAULT_SETTINGS.frequency);
          setAutoDetectFrequencyState(settings.autoDetectFrequency ?? DEFAULT_SETTINGS.autoDetectFrequency);
          setCsvSeparatorState(settings.csvSeparator ?? DEFAULT_SETTINGS.csvSeparator);
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
          setFrequencyState(settings.frequency ?? DEFAULT_SETTINGS.frequency);
          setAutoDetectFrequencyState(settings.autoDetectFrequency ?? DEFAULT_SETTINGS.autoDetectFrequency);
          setCsvSeparatorState(settings.csvSeparator ?? DEFAULT_SETTINGS.csvSeparator);
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

  // Save settings to localStorage whenever they change
  const saveSettings = useCallback((periods: number, context: BusinessContext, grokEnabled: boolean, csvEnabled: boolean, aiFailureThreshold: number) => {
    try {
      const settings: GlobalSettings = {
        forecastPeriods: periods,
        businessContext: context,
        aiForecastModelOptimizationEnabled: grokEnabled,
        aiCsvImportEnabled: csvEnabled,
        aiFailureThreshold
      };
      localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
      // Dispatch custom event for same-tab synchronization
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: { key: GLOBAL_SETTINGS_KEY, newValue: JSON.stringify(settings) }
      }));
    } catch (error) {
      // Silent error handling
    }
  }, []);

  const onSettingsChangeRef = useRef<UseGlobalSettingsProps['onSettingsChange']>(props?.onSettingsChange);

  // Allow dynamic assignment of the handler
  const setOnSettingsChange = useCallback((handler: UseGlobalSettingsProps['onSettingsChange']) => {
    onSettingsChangeRef.current = handler;
  }, []);

  const setForecastPeriods = useCallback((periods: number) => {
    const oldPeriods = forecastPeriods;
    setForecastPeriodsState(periods);
    saveSettings(periods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (oldPeriods !== periods && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('forecastPeriods');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    const oldContext = businessContext;
    setBusinessContextState(context);
    saveSettings(forecastPeriods, context, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (JSON.stringify(oldContext) !== JSON.stringify(context) && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('businessContext');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setaiForecastModelOptimizationEnabled = useCallback((enabled: boolean) => {
    const oldEnabled = aiForecastModelOptimizationEnabled;
    const newEnabled = enabled && aiEnabled;
    setaiForecastModelOptimizationEnabledState(newEnabled);
    saveSettings(forecastPeriods, businessContext, newEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (oldEnabled !== newEnabled && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiForecastModelOptimizationEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings, aiEnabled]);

  const setAiCsvImportEnabled = useCallback((enabled: boolean) => {
    setAiCsvImportEnabledState(enabled);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, enabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiCsvImportEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setAiFailureThreshold = useCallback((threshold: number) => {
    setAiFailureThresholdState(threshold);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, threshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiFailureThreshold');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setLargeFileProcessingEnabled = useCallback((enabled: boolean) => {
    setLargeFileProcessingEnabledState(enabled);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('largeFileProcessingEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setLargeFileThreshold = useCallback((threshold: number) => {
    setLargeFileThresholdState(threshold);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('largeFileThreshold');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setAiReasoningEnabled = useCallback((enabled: boolean) => {
    setAiReasoningEnabledState(enabled);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiReasoningEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setMapeWeight = useCallback((weight: number) => {
    setMapeWeightState(weight);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('mapeWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setRmseWeight = useCallback((weight: number) => {
    setRmseWeightState(weight);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('rmseWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setMaeWeight = useCallback((weight: number) => {
    setMaeWeightState(weight);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('maeWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setAccuracyWeight = useCallback((weight: number) => {
    setAccuracyWeightState(weight);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('accuracyWeight');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setFrequency = useCallback((freq: number) => {
    setFrequencyState(freq);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('frequency');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setAutoDetectFrequency = useCallback((enabled: boolean) => {
    setAutoDetectFrequencyState(enabled);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('autoDetectFrequency');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

  const setCsvSeparator = useCallback((separator: string) => {
    setCsvSeparatorState(separator);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('csvSeparator');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiCsvImportEnabled, aiFailureThreshold, saveSettings]);

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
    setCsvSeparatorState(DEFAULT_SETTINGS.csvSeparator);
    saveSettings(DEFAULT_SETTINGS.forecastPeriods, DEFAULT_SETTINGS.businessContext, DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled, DEFAULT_SETTINGS.aiCsvImportEnabled, DEFAULT_SETTINGS.aiFailureThreshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('forecastPeriods');
    }
  }, [saveSettings]);

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
    frequency,
    setFrequency,
    autoDetectFrequency,
    setAutoDetectFrequency,
    csvSeparator,
    setCsvSeparator,
    resetToDefaults,
    setOnSettingsChange
  };
};
