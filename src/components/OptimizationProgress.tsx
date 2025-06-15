import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptimizationQueue } from "@/types/optimization";

interface OptimizationProgressProps {
  queueSize: number;
  uniqueSKUCount: number;
  isOptimizing: boolean;
  progress: number;
  hasTriggeredOptimization: boolean;
}

export const OptimizationProgress: React.FC<OptimizationProgressProps> = () => {
  return null;
}; 