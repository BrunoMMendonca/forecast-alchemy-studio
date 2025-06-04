
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, CheckCircle, Star, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getModelRecommendation, GrokModelRecommendation } from '@/utils/grokApiUtils';
import { ModelComparisonReasoning } from './ModelComparisonReasoning';
import { ReasoningDisplay } from './ReasoningDisplay';

interface ModelRecommendationProps {
  historicalData: number[];
  dataFrequency: string;
  availableModels: Array<{ id: string; name: string; enabled: boolean }>;
  onModelRecommendation: (recommendation: GrokModelRecommendation) => void;
}

export const ModelRecommendation: React.FC<ModelRecommendationProps> = ({
  historicalData,
  dataFrequency,
  availableModels,
  onModelRecommendation
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<GrokModelRecommendation | null>(null);
  const [userChoice, setUserChoice] = useState<string>('');
  const [businessContext, setBusinessContext] = useState({
    costOfError: 'medium' as 'low' | 'medium' | 'high',
    forecastHorizon: 'medium' as 'short' | 'medium' | 'long',
    interpretabilityNeeds: 'medium' as 'low' | 'medium' | 'high'
  });
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Grok API key to get AI recommendations",
        variant: "destructive",
      });
      return;
    }

    if (historicalData.length < 10) {
      toast({
        title: "Insufficient Data",
        description: "Need at least 10 data points for analysis",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const result = await getModelRecommendation(historicalData, dataFrequency, apiKey, businessContext);
      setRecommendation(result);
      setUserChoice(result.recommendedModel);
      onModelRecommendation(result);
      
      toast({
        title: "Analysis Complete",
        description: `AI recommends ${result.recommendedModel} with ${result.confidence}% confidence`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Failed to get AI recommendation. Check your API key and try again.",
        variant: "destructive",
      });
      console.error('Recommendation error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-600" />
          AI Model Recommendation
        </CardTitle>
        <CardDescription>
          Get AI-powered recommendations for the best forecasting model based on your data patterns and business context
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!recommendation && (
          <>
            <div className="space-y-2">
              <Label htmlFor="recommendation-api-key">Grok API Key</Label>
              <Input
                id="recommendation-api-key"
                type="password"
                placeholder="Enter your Grok API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Your API key is used only for this analysis and not stored
              </p>
            </div>

            {/* Business Context Controls */}
            <div className="space-y-3 bg-white p-3 rounded border">
              <Label className="text-sm font-medium">Business Context (Optional)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Cost of Error</Label>
                  <select 
                    value={businessContext.costOfError}
                    onChange={(e) => setBusinessContext({...businessContext, costOfError: e.target.value as any})}
                    className="w-full text-xs border rounded px-2 py-1"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Forecast Horizon</Label>
                  <select 
                    value={businessContext.forecastHorizon}
                    onChange={(e) => setBusinessContext({...businessContext, forecastHorizon: e.target.value as any})}
                    className="w-full text-xs border rounded px-2 py-1"
                  >
                    <option value="short">Short-term</option>
                    <option value="medium">Medium-term</option>
                    <option value="long">Long-term</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Interpretability</Label>
                  <select 
                    value={businessContext.interpretabilityNeeds}
                    onChange={(e) => setBusinessContext({...businessContext, interpretabilityNeeds: e.target.value as any})}
                    className="w-full text-xs border rounded px-2 py-1"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data Summary</Label>
              <div className="grid grid-cols-2 gap-2 text-sm bg-white p-3 rounded border">
                <div className="flex justify-between">
                  <span>Data points:</span>
                  <span className="font-mono">{historicalData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frequency:</span>
                  <span className="font-mono">{dataFrequency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Latest value:</span>
                  <span className="font-mono">{historicalData[historicalData.length - 1]}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average:</span>
                  <span className="font-mono">
                    {(historicalData.reduce((a, b) => a + b, 0) / historicalData.length).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || !apiKey.trim()}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Data Patterns...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Get AI Recommendation
                </>
              )}
            </Button>
          </>
        )}

        {recommendation && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">AI Analysis Complete</span>
            </div>

            {/* Enhanced Reasoning Display */}
            <ReasoningDisplay
              reasoning={recommendation.reasoning}
              confidence={recommendation.confidence}
              method="ai_recommendation"
              title="Model Selection Reasoning"
            />

            {/* Model Comparison with Multi-Criteria Reasoning */}
            {recommendation.alternativeModels.length > 0 && (
              <ModelComparisonReasoning
                comparisons={[
                  {
                    model: recommendation.recommendedModel,
                    score: recommendation.confidence,
                    accuracy: recommendation.alternativeModels.find(m => m.model === recommendation.recommendedModel)?.accuracy || 85,
                    stability: recommendation.alternativeModels.find(m => m.model === recommendation.recommendedModel)?.stability || 80,
                    interpretability: recommendation.alternativeModels.find(m => m.model === recommendation.recommendedModel)?.interpretability || 75,
                    businessFit: recommendation.alternativeModels.find(m => m.model === recommendation.recommendedModel)?.businessFit || 80,
                    reason: `Recommended choice: ${recommendation.reasoning.slice(0, 100)}...`,
                    isRecommended: true
                  },
                  ...recommendation.alternativeModels.map(alt => ({
                    model: alt.model,
                    score: alt.score,
                    accuracy: alt.accuracy,
                    stability: alt.stability,
                    interpretability: alt.interpretability,
                    businessFit: alt.businessFit,
                    reason: alt.reason
                  }))
                ]}
                reasoning={recommendation.reasoning}
                decisionFactors={recommendation.decisionFactors}
              />
            )}

            <div className="space-y-2">
              <Label>Your Choice</Label>
              <div className="grid grid-cols-1 gap-2">
                {[recommendation.recommendedModel, ...recommendation.alternativeModels.map(a => a.model)].map((modelName) => (
                  <label key={modelName} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="model-choice"
                      value={modelName}
                      checked={userChoice === modelName}
                      onChange={(e) => setUserChoice(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className={`${userChoice === modelName ? 'font-semibold text-blue-800' : ''} flex items-center gap-1`}>
                      {modelName}
                      {modelName === recommendation.recommendedModel && (
                        <Star className="h-3 w-3 text-yellow-500" />
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  toast({
                    title: "Model Selected",
                    description: `You've chosen ${userChoice} for forecasting`,
                  });
                }}
                className="flex-1"
                disabled={!userChoice}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Use {userChoice}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setRecommendation(null)}
                className="flex-1"
              >
                Analyze Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
