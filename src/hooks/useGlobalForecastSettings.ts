import { useState, useCallback, useEffect, useRef } from 'react';
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';
import { useAISettings } from './useAISettings';

const GLOBAL_SETTINGS_KEY = 'global_forecast_settings';

interface GlobalForecastSettings {
  forecastPeriods: number;
  businessContext: BusinessContext;
  aiForecastModelOptimizationEnabled: boolean;
  aiFailureThreshold: number;
}

const DEFAULT_SETTINGS: GlobalForecastSettings = {
  forecastPeriods: 12,
  businessContext: DEFAULT_BUSINESS_CONTEXT,
  aiForecastModelOptimizationEnabled: false,
  aiFailureThreshold: 5
};

interface UseGlobalForecastSettingsProps {
  onSettingsChange?: (changedSetting: 'forecastPeriods' | 'businessContext' | 'aiForecastModelOptimizationEnabled' | 'aiFailureThreshold') => void;
}

export const useGlobalForecastSettings = (props?: UseGlobalForecastSettingsProps) => {
  const [forecastPeriods, setForecastPeriodsState] = useState<number>(DEFAULT_SETTINGS.forecastPeriods);
  const [businessContext, setBusinessContextState] = useState<BusinessContext>(DEFAULT_SETTINGS.businessContext);
  const [aiForecastModelOptimizationEnabled, setaiForecastModelOptimizationEnabledState] = useState<boolean>(DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
  const [aiFailureThreshold, setAiFailureThresholdState] = useState<number>(DEFAULT_SETTINGS.aiFailureThreshold);

  // Initialize AI settings
  const { enabled: aiEnabled } = useAISettings();

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GLOBAL_SETTINGS_KEY);
      if (stored) {
        const settings: GlobalForecastSettings = JSON.parse(stored);
        setForecastPeriodsState(settings.forecastPeriods || DEFAULT_SETTINGS.forecastPeriods);
        setBusinessContextState(settings.businessContext || DEFAULT_SETTINGS.businessContext);
        setaiForecastModelOptimizationEnabledState(settings.aiForecastModelOptimizationEnabled ?? DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
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
          const settings: GlobalForecastSettings = JSON.parse(event.newValue);
          setForecastPeriodsState(settings.forecastPeriods || DEFAULT_SETTINGS.forecastPeriods);
          setBusinessContextState(settings.businessContext || DEFAULT_SETTINGS.businessContext);
          setaiForecastModelOptimizationEnabledState(settings.aiForecastModelOptimizationEnabled ?? DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
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
          const settings: GlobalForecastSettings = JSON.parse(event.detail.newValue);
          setForecastPeriodsState(settings.forecastPeriods || DEFAULT_SETTINGS.forecastPeriods);
          setBusinessContextState(settings.businessContext || DEFAULT_SETTINGS.businessContext);
          setaiForecastModelOptimizationEnabledState(settings.aiForecastModelOptimizationEnabled ?? DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
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
  const saveSettings = useCallback((periods: number, context: BusinessContext, grokEnabled: boolean, aiFailureThreshold: number) => {
    try {
      const settings: GlobalForecastSettings = {
        forecastPeriods: periods,
        businessContext: context,
        aiForecastModelOptimizationEnabled: grokEnabled,
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

  const onSettingsChangeRef = useRef<UseGlobalForecastSettingsProps['onSettingsChange']>(props?.onSettingsChange);

  // Allow dynamic assignment of the handler
  const setOnSettingsChange = useCallback((handler: UseGlobalForecastSettingsProps['onSettingsChange']) => {
    onSettingsChangeRef.current = handler;
  }, []);

  const setForecastPeriods = useCallback((periods: number) => {
    const oldPeriods = forecastPeriods;
    setForecastPeriodsState(periods);
    saveSettings(periods, businessContext, aiForecastModelOptimizationEnabled, aiFailureThreshold);
    if (oldPeriods !== periods && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('forecastPeriods');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiFailureThreshold, saveSettings]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    const oldContext = businessContext;
    setBusinessContextState(context);
    saveSettings(forecastPeriods, context, aiForecastModelOptimizationEnabled, aiFailureThreshold);
    if (JSON.stringify(oldContext) !== JSON.stringify(context) && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('businessContext');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiFailureThreshold, saveSettings]);

  const setaiForecastModelOptimizationEnabled = useCallback((enabled: boolean) => {
    const oldEnabled = aiForecastModelOptimizationEnabled;
    const newEnabled = enabled && aiEnabled;
    setaiForecastModelOptimizationEnabledState(newEnabled);
    saveSettings(forecastPeriods, businessContext, newEnabled, aiFailureThreshold);
    if (oldEnabled !== newEnabled && onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiForecastModelOptimizationEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiFailureThreshold, saveSettings, aiEnabled]);

  const setAiFailureThreshold = useCallback((threshold: number) => {
    setAiFailureThresholdState(threshold);
    saveSettings(forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, threshold);
    if (onSettingsChangeRef.current) {
      onSettingsChangeRef.current('aiForecastModelOptimizationEnabled');
    }
  }, [forecastPeriods, businessContext, aiForecastModelOptimizationEnabled, aiFailureThreshold, saveSettings]);

  const resetToDefaults = useCallback(() => {
    setForecastPeriodsState(DEFAULT_SETTINGS.forecastPeriods);
    setBusinessContextState(DEFAULT_SETTINGS.businessContext);
    setaiForecastModelOptimizationEnabledState(DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled);
    setAiFailureThresholdState(DEFAULT_SETTINGS.aiFailureThreshold);
    saveSettings(DEFAULT_SETTINGS.forecastPeriods, DEFAULT_SETTINGS.businessContext, DEFAULT_SETTINGS.aiForecastModelOptimizationEnabled, DEFAULT_SETTINGS.aiFailureThreshold);
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
    aiFailureThreshold,
    setAiFailureThreshold,
    resetToDefaults,
    setOnSettingsChange
  };
};
