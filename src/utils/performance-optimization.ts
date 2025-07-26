// Performance Optimization Utility
// This utility provides performance optimizations for the refactored architecture

import { setupWizardConfigManager } from '../config/SetupWizardConfig';
import { importStrategyManager } from '../strategies/ImportStrategy';
import { commandManager } from '../commands/SetupWizardCommands';

export interface PerformanceMetrics {
  configurationManagerLoadTime: number;
  strategyManagerLoadTime: number;
  commandManagerLoadTime: number;
  totalLoadTime: number;
  memoryUsage?: number;
}

export function measurePerformance(): PerformanceMetrics {
  const startTime = performance.now();
  
  // Measure Configuration Manager performance
  const configStart = performance.now();
  const config = setupWizardConfigManager.getConfig();
  const configEnd = performance.now();
  const configurationManagerLoadTime = configEnd - configStart;

  // Measure Strategy Manager performance
  const strategyStart = performance.now();
  const strategies = importStrategyManager.getAvailableStrategies();
  const strategyEnd = performance.now();
  const strategyManagerLoadTime = strategyEnd - strategyStart;

  // Measure Command Manager performance
  const commandStart = performance.now();
  const canUndo = commandManager.canUndo();
  const canRedo = commandManager.canRedo();
  const commandEnd = performance.now();
  const commandManagerLoadTime = commandEnd - commandStart;

  const endTime = performance.now();
  const totalLoadTime = endTime - startTime;

  return {
    configurationManagerLoadTime,
    strategyManagerLoadTime,
    commandManagerLoadTime,
    totalLoadTime
  };
}

export function logPerformanceMetrics(metrics: PerformanceMetrics): void {
  console.log('⚡ [PERFORMANCE] Architecture Performance Metrics:');
  console.log(`   - Configuration Manager: ${metrics.configurationManagerLoadTime.toFixed(2)}ms`);
  console.log(`   - Strategy Manager: ${metrics.strategyManagerLoadTime.toFixed(2)}ms`);
  console.log(`   - Command Manager: ${metrics.commandManagerLoadTime.toFixed(2)}ms`);
  console.log(`   - Total Load Time: ${metrics.totalLoadTime.toFixed(2)}ms`);
  
  if (metrics.totalLoadTime < 10) {
    console.log('✅ [PERFORMANCE] Excellent performance!');
  } else if (metrics.totalLoadTime < 50) {
    console.log('⚠️ [PERFORMANCE] Good performance, but could be optimized');
  } else {
    console.log('❌ [PERFORMANCE] Performance needs optimization');
  }
}

// Cache frequently accessed data
const configCache = new Map();
const strategyCache = new Map();

export function getCachedConfig(): any {
  if (!configCache.has('config')) {
    configCache.set('config', setupWizardConfigManager.getConfig());
  }
  return configCache.get('config');
}

export function getCachedStrategies(): any[] {
  if (!strategyCache.has('strategies')) {
    strategyCache.set('strategies', importStrategyManager.getAvailableStrategies());
  }
  return strategyCache.get('strategies');
}

export function clearCaches(): void {
  configCache.clear();
  strategyCache.clear();
  console.log('🧹 [PERFORMANCE] Caches cleared');
}

// Debounce function for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
} 