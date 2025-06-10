import { useState, useCallback, useEffect } from 'react';
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';
import { useAISettings } from './useAISettings';

const GLOBAL_SETTINGS_KEY = 'global_forecast_settings';

interface GlobalForecastSettings {
  forecastPeriods: number;
  businessContext: BusinessContext;
  grokApiEnabled: boolean;
}

const DEFAULT_SETTINGS: GlobalForecastSettings = {
  forecastPeriods: 12,
  businessContext: DEFAULT_BUSINESS_CONTEXT,
  grokApiEnabled: true
};

interface UseGlobalForecastSettingsProps {
  onSettingsChange?: (changedSetting: 'forecastPeriods' | 'businessContext' | 'grokApiEnabled') => void;
}

export const useGlobalForecastSettings = (props?: UseGlobalForecastSettingsProps) => {
  const [forecastPeriods, setForecastPeriodsState] = useState<number>(DEFAULT_SETTINGS.forecastPeriods);
  const [businessContext, setBusinessContextState] = useState<BusinessContext>(DEFAULT_SETTINGS.businessContext);
  const [grokApiEnabled, setGrokApiEnabledState] = useState<boolean>(DEFAULT_SETTINGS.grokApiEnabled);

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
        setGrokApiEnabledState(settings.grokApiEnabled ?? DEFAULT_SETTINGS.grokApiEnabled);
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
          setGrokApiEnabledState(settings.grokApiEnabled ?? DEFAULT_SETTINGS.grokApiEnabled);
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
          setGrokApiEnabledState(settings.grokApiEnabled ?? DEFAULT_SETTINGS.grokApiEnabled);
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
  const saveSettings = useCallback((periods: number, context: BusinessContext, grokEnabled: boolean) => {
    try {
      const settings: GlobalForecastSettings = {
        forecastPeriods: periods,
        businessContext: context,
        grokApiEnabled: grokEnabled
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

  const setForecastPeriods = useCallback((periods: number) => {
    const oldPeriods = forecastPeriods;
    setForecastPeriodsState(periods);
    saveSettings(periods, businessContext, grokApiEnabled);
    
    // Trigger re-optimization if the value actually changed
    if (oldPeriods !== periods && props?.onSettingsChange) {
      props.onSettingsChange('forecastPeriods');
    }
  }, [forecastPeriods, businessContext, grokApiEnabled, saveSettings, props]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    const oldContext = businessContext;
    setBusinessContextState(context);
    saveSettings(forecastPeriods, context, grokApiEnabled);
    
    // Trigger re-optimization if the value actually changed
    if (JSON.stringify(oldContext) !== JSON.stringify(context) && props?.onSettingsChange) {
      props.onSettingsChange('businessContext');
    }
  }, [forecastPeriods, businessContext, grokApiEnabled, saveSettings, props]);

  const setGrokApiEnabled = useCallback((enabled: boolean) => {
    const oldEnabled = grokApiEnabled;
    // If AI is disabled, force Grok to be disabled
    const newEnabled = enabled && aiEnabled;
    setGrokApiEnabledState(newEnabled);
    saveSettings(forecastPeriods, businessContext, newEnabled);
    
    // Trigger re-optimization if the value actually changed
    if (oldEnabled !== newEnabled && props?.onSettingsChange) {
      props.onSettingsChange('grokApiEnabled');
    }
  }, [forecastPeriods, businessContext, grokApiEnabled, saveSettings, props, aiEnabled]);

  const resetToDefaults = useCallback(() => {
    setForecastPeriodsState(DEFAULT_SETTINGS.forecastPeriods);
    setBusinessContextState(DEFAULT_SETTINGS.businessContext);
    setGrokApiEnabledState(DEFAULT_SETTINGS.grokApiEnabled);
    saveSettings(DEFAULT_SETTINGS.forecastPeriods, DEFAULT_SETTINGS.businessContext, DEFAULT_SETTINGS.grokApiEnabled);
    
    // Trigger re-optimization for reset
    if (props?.onSettingsChange) {
      props.onSettingsChange('forecastPeriods');
    }
  }, [saveSettings, props]);

  return {
    forecastPeriods,
    setForecastPeriods,
    businessContext,
    setBusinessContext,
    grokApiEnabled,
    setGrokApiEnabled,
    resetToDefaults
  };
};
