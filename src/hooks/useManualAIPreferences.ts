import { useCallback } from 'react';

const MANUAL_AI_PREFERENCE_KEY = 'manual_ai_preferences';

export const useManualAIPreferences = () => {
  // Load manual/AI preferences from localStorage
  const loadManualAIPreferences = useCallback((): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(MANUAL_AI_PREFERENCE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load manual/AI preferences:', error);
      return {};
    }
  }, []);

  // Save manual/AI preferences to localStorage
  const saveManualAIPreferences = useCallback((preferences: Record<string, boolean>) => {
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
