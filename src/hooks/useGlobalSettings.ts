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
}

const DEFAULT_SETTINGS: GlobalSettings = {
  forecastPeriods: 12,
  businessContext: DEFAULT_BUSINESS_CONTEXT,
  aiForecastModelOptimizationEnabled: false,
  aiCsvImportEnabled: true,
  aiFailureThreshold: 5
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

  const resetToDefaults = useCallback(() => {
    setForecastPeriodsState(DEFAULT_SETTINGS.forecastPeriods);
    setBusinessContextState(DEFAULT_SETTINGS.businessContext);
    setaiForecastModelOptimizationEnabledState(DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
    setAiCsvImportEnabledState(DEFAULT_SETTINGS.aiCsvImportEnabled);
    setAiFailureThresholdState(DEFAULT_SETTINGS.aiFailureThreshold);
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
    resetToDefaults,
    setOnSettingsChange
  };
};
