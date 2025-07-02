import { GlobalSettings } from '@/types/globalSettings';
import { DEFAULT_BUSINESS_CONTEXT } from '@/types/businessContext';

const GLOBAL_SETTINGS_KEY = 'global_settings';

// Default settings (import or duplicate if needed)
export const DEFAULT_SETTINGS: GlobalSettings = {
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

/**
 * Get global settings from backend
 */
export async function getBackendSettings(): Promise<Partial<GlobalSettings>> {
  try {
    const response = await fetch('/api/settings');
    if (response.ok) {
      const backendSettings = await response.json();
      
      // Map backend settings to frontend format
      return {
        frequency: backendSettings.global_frequency,
        autoDetectFrequency: backendSettings.global_autoDetectFrequency,
        csvSeparator: backendSettings.global_csvSeparator,
      };
    }
  } catch (e) {
    console.warn('Failed to fetch backend settings:', e);
  }
  return {};
}

/**
 * Save settings to backend
 */
export async function saveBackendSettings(settings: Partial<GlobalSettings>): Promise<boolean> {
  try {
    const backendSettings = {
      frequency: settings.frequency,
      seasonalPeriods: settings.frequency === 'monthly' ? 12 : 
                       settings.frequency === 'weekly' ? 52 : 
                       settings.frequency === 'daily' ? 7 : 
                       settings.frequency === 'quarterly' ? 4 : 12,
      autoDetectFrequency: settings.autoDetectFrequency,
      csvSeparator: settings.csvSeparator,
    };

    console.debug('[saveBackendSettings] Updating backend with:', backendSettings);

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendSettings),
    });

    return response.ok;
  } catch (e) {
    console.error('Failed to save backend settings:', e);
    return false;
  }
}

/**
 * Get global settings (localStorage for now, ready for API in future)
 */
export async function getSettings(): Promise<GlobalSettings> {
  // Try to get backend settings first
  const backendSettings = await getBackendSettings();
  
  try {
    const stored = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (stored) {
      const localSettings = JSON.parse(stored);
      // Merge backend settings with local settings, prioritizing backend for syncable settings
      return { 
        ...DEFAULT_SETTINGS, 
        ...localSettings,
        ...backendSettings // Backend settings override local for syncable fields
      };
    }
  } catch (e) {
    // Silent error
  }
  
  return { ...DEFAULT_SETTINGS, ...backendSettings };
}

/**
 * Save global settings (localStorage for now, ready for API in future)
 */
export async function saveSettings(settings: GlobalSettings): Promise<void> {

  // Save to localStorage
  try {
    localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch custom event for same-tab synchronization
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: { key: GLOBAL_SETTINGS_KEY, newValue: JSON.stringify(settings) }
    }));
  } catch (e) {
    // Silent error
  }

  // Sync relevant settings to backend
  const syncableSettings = {
    frequency: settings.frequency,
    autoDetectFrequency: settings.autoDetectFrequency,
    csvSeparator: settings.csvSeparator,
  };
  
  await saveBackendSettings(syncableSettings);
} 