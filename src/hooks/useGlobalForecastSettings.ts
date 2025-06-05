
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

export const useGlobalForecastSettings = () => {
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
        console.log('📋 Loaded global forecast settings from localStorage:', settings);
      }
    } catch (error) {
      console.error('Failed to load global forecast settings:', error);
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
      console.log('💾 Saved global forecast settings to localStorage:', settings);
    } catch (error) {
      console.error('Failed to save global forecast settings:', error);
    }
  }, []);

  const setForecastPeriods = useCallback((periods: number) => {
    setForecastPeriodsState(periods);
    saveSettings(periods, businessContext);
  }, [businessContext, saveSettings]);

  const setBusinessContext = useCallback((context: BusinessContext) => {
    setBusinessContextState(context);
    saveSettings(forecastPeriods, context);
  }, [forecastPeriods, saveSettings]);

  const resetToDefaults = useCallback(() => {
    setForecastPeriodsState(DEFAULT_SETTINGS.forecastPeriods);
    setBusinessContextState(DEFAULT_SETTINGS.businessContext);
    saveSettings(DEFAULT_SETTINGS.forecastPeriods, DEFAULT_SETTINGS.businessContext);
  }, [saveSettings]);

  return {
    forecastPeriods,
    setForecastPeriods,
    businessContext,
    setBusinessContext,
    resetToDefaults
  };
};
