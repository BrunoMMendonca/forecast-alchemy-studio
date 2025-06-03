
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, CheckCircle, Star, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getModelRecommendation, GrokModelRecommendation } from '@/utils/grokApiUtils';

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
      const result = await getModelRecommendation(historicalData, dataFrequency, apiKey);
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

  const modelNameMap: Record<string, string> = {
    'Simple Moving Average': 'moving_average',
    'Exponential Smoothing': 'exponential_smoothing',
    'Linear Trend': 'linear_trend',
    'Seasonal Moving Average': 'seasonal_moving_average',
    'Holt-Winters': 'holt_winters',
    'Seasonal Naive': 'seasonal_naive'
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-600" />
          AI Model Recommendation
        </CardTitle>
        <CardDescription>
          Get AI-powered recommendations for the best forecasting model based on your data patterns
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

            <div className="space-y-3">
              <div className="p-4 bg-white rounded-lg border-2 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold">AI Recommended</span>
                  </div>
                  <Badge variant="secondary" className={getConfidenceColor(recommendation.confidence)}>
                    {recommendation.confidence.toFixed(0)}% confidence
                  </Badge>
                </div>
                <h4 className="font-bold text-lg text-blue-800">{recommendation.recommendedModel}</h4>
                <p className="text-sm text-slate-600 mt-1">{recommendation.reasoning}</p>
              </div>

              {recommendation.alternativeModels.length > 0 && (
                <div className="space-y-2">
                  <Label>Alternative Models</Label>
                  {recommendation.alternativeModels.map((alt, index) => (
                    <div key={index} className="p-3 bg-white rounded border flex justify-between items-center">
                      <div>
                        <div className="font-medium">{alt.model}</div>
                        <div className="text-xs text-slate-500">{alt.reason}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {alt.score.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};
