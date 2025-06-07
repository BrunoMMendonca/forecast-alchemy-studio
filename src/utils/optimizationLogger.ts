
export interface OptimizationStep {
  id: string;
  timestamp: number;
  sku: string;
  modelId: string;
  step: 'start' | 'ai_attempt' | 'ai_success' | 'ai_rejected' | 'grid_search' | 'validation' | 'complete' | 'error';
  message: string;
  parameters?: Record<string, number>;
  accuracy?: number;
  confidence?: number;
  error?: string;
}

export interface OptimizationLog {
  sessionId: string;
  startTime: number;
  steps: OptimizationStep[];
  summary: {
    totalSKUs: number;
    aiOptimized: number;
    gridOptimized: number;
    aiRejected: number;
    errors: number;
  };
}

class OptimizationLogger {
  private currentLog: OptimizationLog | null = null;
  private listeners: ((log: OptimizationLog) => void)[] = [];

  startSession(totalSKUs: number): string {
    const sessionId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentLog = {
      sessionId,
      startTime: Date.now(),
      steps: [],
      summary: {
        totalSKUs,
        aiOptimized: 0,
        gridOptimized: 0,
        aiRejected: 0,
        errors: 0
      }
    };

    this.notifyListeners();
    return sessionId;
  }

  logStep(step: Omit<OptimizationStep, 'id' | 'timestamp'>): void {
    if (!this.currentLog) return;

    const optimizationStep: OptimizationStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      ...step
    };

    this.currentLog.steps.push(optimizationStep);

    // Update summary based on step type
    switch (step.step) {
      case 'ai_success':
        this.currentLog.summary.aiOptimized++;
        break;
      case 'ai_rejected':
        this.currentLog.summary.aiRejected++;
        break;
      case 'grid_search':
        this.currentLog.summary.gridOptimized++;
        break;
      case 'error':
        this.currentLog.summary.errors++;
        break;
    }

    this.notifyListeners();
  }

  logBatchStart(skus: string[]): void {
    // Removed verbose logging
  }

  logSKUComplete(sku: string): void {
    // Removed verbose logging
  }

  logBatchComplete(totalOptimized: number): void {
    // Removed verbose logging
  }

  getCurrentLog(): OptimizationLog | null {
    return this.currentLog;
  }

  endSession(): OptimizationLog | null {
    const log = this.currentLog;
    this.currentLog = null;
    return log;
  }

  subscribe(listener: (log: OptimizationLog) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    if (this.currentLog) {
      this.listeners.forEach(listener => listener(this.currentLog!));
    }
  }
}

export const optimizationLogger = new OptimizationLogger();
