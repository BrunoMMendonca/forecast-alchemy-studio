import { useState, useCallback, useEffect } from 'react';

const AI_SETTINGS_KEY = 'ai_settings';

interface AISettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  enabled: true
};

interface UseAISettingsProps {
  onSettingsChange?: (enabled: boolean) => void;
}

export const useAISettings = (props?: UseAISettingsProps) => {
  const [enabled, setEnabledState] = useState<boolean>(DEFAULT_SETTINGS.enabled);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AI_SETTINGS_KEY);
      if (stored) {
        const settings: AISettings = JSON.parse(stored);
        setEnabledState(settings.enabled ?? DEFAULT_SETTINGS.enabled);
      }
    } catch (error) {
      // Silent error handling
    }
  }, []);

  // Listen for localStorage changes to sync state across hook instances
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === AI_SETTINGS_KEY && event.newValue) {
        try {
          const settings: AISettings = JSON.parse(event.newValue);
          setEnabledState(settings.enabled ?? DEFAULT_SETTINGS.enabled);
        } catch (error) {
          // Silent error handling
        }
      }
    };

    const handleCustomStorageChange = (event: CustomEvent) => {
      if (event.detail.key === AI_SETTINGS_KEY) {
        try {
          const settings: AISettings = JSON.parse(event.detail.newValue);
          setEnabledState(settings.enabled ?? DEFAULT_SETTINGS.enabled);
        } catch (error) {
          // Silent error handling
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange);
    };
  }, []);

  // Save settings to localStorage whenever they change
  const saveSettings = useCallback((enabled: boolean) => {
    try {
      const settings: AISettings = { enabled };
      const newSettingsValue = JSON.stringify(settings);
      localStorage.setItem(AI_SETTINGS_KEY, newSettingsValue);
      // Dispatch custom event for same-tab synchronization
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: { key: AI_SETTINGS_KEY, newValue: newSettingsValue }
      }));
    } catch (error) {
      // Silent error handling
    }
  }, []);

  const setEnabled = useCallback((newEnabled: boolean) => {
    const oldEnabled = enabled;
    setEnabledState(newEnabled);
    saveSettings(newEnabled);
    
    // Trigger callback if the value actually changed
    if (oldEnabled !== newEnabled && props?.onSettingsChange) {
      props.onSettingsChange(newEnabled);
    }
  }, [enabled, saveSettings, props]);

  const resetToDefaults = useCallback(() => {
    setEnabledState(DEFAULT_SETTINGS.enabled);
    saveSettings(DEFAULT_SETTINGS.enabled);
    
    // Trigger callback for reset
    if (props?.onSettingsChange) {
      props.onSettingsChange(DEFAULT_SETTINGS.enabled);
    }
  }, [saveSettings, props]);

  return {
    enabled,
    setEnabled,
    resetToDefaults
  };
}; 