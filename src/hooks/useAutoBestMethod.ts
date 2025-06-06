
import { useCallback } from 'react';

const AUTO_BEST_METHOD_KEY = 'auto_best_method';

// Represents the automatic system choice for best available method
export type AutoMethodValue = 'manual' | 'ai' | 'grid';

export const useAutoBestMethod = () => {
  // Load automatic best method selections from localStorage
  const loadAutoBestMethod = useCallback((): Record<string, AutoMethodValue> => {
    try {
      const stored = localStorage.getItem(AUTO_BEST_METHOD_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      
      // Migrate old preference data if it exists
      const oldPrefs = localStorage.getItem('manual_ai_preferences');
      if (oldPrefs && !stored) {
        const oldParsed = JSON.parse(oldPrefs);
        const migrated: Record<string, AutoMethodValue> = {};
        Object.keys(oldParsed).forEach(key => {
          const value = oldParsed[key];
          if (value === true) {
            migrated[key] = 'ai';
          } else if (value === false) {
            migrated[key] = 'manual';
          } else if (value === 'grid') {
            migrated[key] = 'grid';
          } else {
            migrated[key] = 'ai';
          }
        });
        return migrated;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to load auto best method:', error);
      return {};
    }
  }, []);

  // Save automatic best method selections to localStorage
  const saveAutoBestMethod = useCallback((methods: Record<string, AutoMethodValue>) => {
    try {
      localStorage.setItem(AUTO_BEST_METHOD_KEY, JSON.stringify(methods));
    } catch (error) {
      console.error('Failed to save auto best method:', error);
    }
  }, []);

  // Clear all automatic best method selections
  const clearAutoBestMethod = useCallback(() => {
    try {
      localStorage.removeItem(AUTO_BEST_METHOD_KEY);
      console.log('🗑️ AUTO-METHOD CLEAR: Cleared all automatic method selections');
    } catch (error) {
      console.error('🗑️ AUTO-METHOD CLEAR: Failed to clear selections:', error);
    }
  }, []);

  return {
    loadAutoBestMethod,
    saveAutoBestMethod,
    clearAutoBestMethod
  };
};
