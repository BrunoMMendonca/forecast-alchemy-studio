
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { optimizeParametersWithGrok, GrokOptimizationResponse } from '@/utils/grokApiUtils';

interface ParameterOptimizerProps {
  modelId: string;
  modelName: string;
  historicalData: number[];
  currentParameters: Record<string, number>;
  seasonalPeriod?: number;
  onParametersOptimized: (parameters: Record<string, number>) => void;
}

export const ParameterOptimizer: React.FC<ParameterOptimizerProps> = ({
  modelId,
  modelName,
  historicalData,
  currentParameters,
  seasonalPeriod,
  onParametersOptimized
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<GrokOptimizationResponse | null>(null);
  const { toast } = useToast();

  const handleOptimize = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Grok API key to optimize parameters",
        variant: "destructive",
      });
      return;
    }

    if (historicalData.length < 10) {
      toast({
        title: "Insufficient Data",
        description: "Need at least 10 data points for optimization",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);

    try {
      const result = await optimizeParametersWithGrok({
        modelType: modelId,
        historicalData,
        currentParameters,
        seasonalPeriod,
        targetMetric: 'mape'
      }, apiKey);

      setOptimizationResult(result);
      
      toast({
        title: "Optimization Complete",
        description: `Parameters optimized with ${result.confidence}% confidence`,
      });
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: "Failed to optimize parameters. Check your API key and try again.",
        variant: "destructive",
      });
      console.error('Optimization error:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimization = () => {
    if (optimizationResult) {
      onParametersOptimized(optimizationResult.optimizedParameters);
      toast({
        title: "Parameters Applied",
        description: "Optimized parameters have been applied to the model",
      });
    }
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-600" />
          AI Parameter Optimization - {modelName}
        </CardTitle>
        <CardDescription>
          Use Grok-3 AI to automatically optimize model parameters for better accuracy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!optimizationResult && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`api-key-${modelId}`}>Grok API Key</Label>
              <Input
                id={`api-key-${modelId}`}
                type="password"
                placeholder="Enter your Grok API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Your API key is used only for this optimization and not stored
              </p>
            </div>

            <div className="space-y-2">
              <Label>Current Parameters</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(currentParameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleOptimize}
              disabled={isOptimizing || !apiKey.trim()}
              className="w-full"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing with AI...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Optimize Parameters
                </>
              )}
            </Button>
          </>
        )}

        {optimizationResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Optimization Complete</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-600">Expected Accuracy</Label>
                <div className="text-lg font-bold text-green-600">
                  {optimizationResult.expectedAccuracy.toFixed(1)}%
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600">AI Confidence</Label>
                <div className="text-lg font-bold text-blue-600">
                  {optimizationResult.confidence.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Optimized Parameters</Label>
              <div className="grid grid-cols-2 gap-2 text-sm bg-white p-3 rounded border">
                {Object.entries(optimizationResult.optimizedParameters).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className="font-mono font-bold text-green-700">
                      {typeof value === 'number' ? value.toFixed(2) : value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>AI Reasoning</Label>
              <div className="text-sm bg-white p-3 rounded border text-slate-700">
                {optimizationResult.reasoning}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyOptimization} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Apply Optimized Parameters
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setOptimizationResult(null)}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
