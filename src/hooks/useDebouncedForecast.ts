
import { useCallback, useRef } from 'react';

interface DebouncedForecastOptions {
  delay?: number;
  maxDelay?: number;
}

export const useDebouncedForecast = (
  forecastFunction: () => void,
  options: DebouncedForecastOptions = {}
) => {
  const { delay = 300, maxDelay = 2000 } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallRef = useRef<number>(0);

  const debouncedForecast = useCallback(() => {
    const now = Date.now();
    
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set up max delay timeout if this is the first call in a while
    if (now - lastCallRef.current > maxDelay) {
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
      maxTimeoutRef.current = setTimeout(() => {
        forecastFunction();
        lastCallRef.current = Date.now();
      }, maxDelay);
    }
    
    // Set up normal debounced call
    timeoutRef.current = setTimeout(() => {
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
      forecastFunction();
      lastCallRef.current = Date.now();
    }, delay);
  }, [forecastFunction, delay, maxDelay]);

  const cancelDebounce = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
    }
  }, []);

  return { debouncedForecast, cancelDebounce };
};
