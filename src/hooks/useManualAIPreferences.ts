
import { useCallback } from 'react';

const MANUAL_AI_PREFERENCE_KEY = 'manual_ai_preferences';

// Simplified preference type: manual, ai, or grid
export type PreferenceValue = 'manual' | 'ai' | 'grid';

export const useManualAIPreferences = () => {
  // Load manual/AI/Grid preferences from localStorage
  const loadManualAIPreferences = useCallback((): Record<string, PreferenceValue> => {
    try {
      const stored = localStorage.getItem(MANUAL_AI_PREFERENCE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      
      // Migrate old boolean values to new string values
      const migrated: Record<string, PreferenceValue> = {};
      Object.keys(parsed).forEach(key => {
        const value = parsed[key];
        if (value === true) {
          migrated[key] = 'ai';
        } else if (value === false) {
          migrated[key] = 'manual';
        } else if (value === 'grid') {
          migrated[key] = 'grid';
        } else {
          // Default to AI for any undefined/unknown values
          migrated[key] = 'ai';
        }
      });
      
      return migrated;
    } catch (error) {
      console.error('Failed to load manual/AI preferences:', error);
      return {};
    }
  }, []);

  // Save manual/AI/Grid preferences to localStorage
  const saveManualAIPreferences = useCallback((preferences: Record<string, PreferenceValue>) => {
    try {
      localStorage.setItem(MANUAL_AI_PREFERENCE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save manual/AI preferences:', error);
    }
  }, []);

  // Clear all manual/AI preferences
  const clearManualAIPreferences = useCallback(() => {
    try {
      localStorage.removeItem(MANUAL_AI_PREFERENCE_KEY);
      console.log('🗑️ PREFERENCES CLEAR: Cleared all manual/AI preferences');
    } catch (error) {
      console.error('🗑️ PREFERENCES CLEAR: Failed to clear preferences:', error);
    }
  }, []);

  return {
    loadManualAIPreferences,
    saveManualAIPreferences,
    clearManualAIPreferences
  };
};
