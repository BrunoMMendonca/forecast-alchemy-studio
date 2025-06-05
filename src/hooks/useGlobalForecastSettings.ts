
import { useState, useEffect, useCallback } from 'react';
import { BusinessContext, DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';

const GLOBAL_SETTINGS_KEY = 'global_forecast_settings';

interface GlobalForecastSettings {
  forecastPeriods: number;
  businessContext: BusinessContext;
}

const DEFAULT_SETTINGS: GlobalForecastSettings = {
  forecastPeriods: 12,
  businessContext: DEFAULT_BUSINESS_CONTEXT
};

interface UseGlobalForecastSettingsProps {
  onSettingsChange?: (changedSetting: 'forecastPeriods' | 'businessContext') => void;
}

export const useGlobalForecastSettings = (props?: UseGlobalForecastSettingsProps) => {
  const [forecastPeriods, setForecastPeriodsState] = useState<number>(DEFAULT_SETTINGS.forecastPeriods);
  const [businessContext, setBusinessContextState] = useState<BusinessContext>(DEFAULT_SETTINGS.businessContext);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GLOBAL_SETTINGS_KEY);
      if (stored) {
        const settings: GlobalForecastSettings = JSON.parse(stored);
        setForecastPeriodsState(settings.forecastPeriods || DEFAULT_SETTINGS.forecastPeriods);
        setBusinessContextState(settings.businessContext || DEFAULT_SETTINGS.businessContext);
      }
    } catch (error) {
      // Silent error handling
    }
  }, []);

  // Save settings to localStorage whenever they change
  const saveSettings = useCallback((periods: number, context: BusinessContext) => {
    try {
      const settings: GlobalForecastSettings = {
        forecastPeriods: periods,
        businessContext: context
      };
      localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      // Silent error handling
    }
  }, []);

  const setForecastPeriods = useCallback((periods: number) => {
    const oldPeriods = forecastPeriods;
    setForecastPeriodsState(periods);
    saveSettings(periods, businessContext);
    
    // Trigger re-optimization if the value actually changed
    if (oldPeriods !== periods && props?.onSettingsChange) {
      props.onSettingsChange('forecastPeriods');
    }
  }, [forecastPeriods, businessContext, saveSettings, props]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    const oldContext = businessContext;
    setBusinessContextState(context);
    saveSettings(forecastPeriods, context);
    
    // Trigger re-optimization if the value actually changed
    if (JSON.stringify(oldContext) !== JSON.stringify(context) && props?.onSettingsChange) {
      props.onSettingsChange('businessContext');
    }
  }, [forecastPeriods, businessContext, saveSettings, props]);

  const resetToDefaults = useCallback(() => {
    setForecastPeriodsState(DEFAULT_SETTINGS.forecastPeriods);
    setBusinessContextState(DEFAULT_SETTINGS.businessContext);
    saveSettings(DEFAULT_SETTINGS.forecastPeriods, DEFAULT_SETTINGS.businessContext);
    
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
    resetToDefaults
  };
};
