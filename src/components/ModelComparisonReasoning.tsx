
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Shield, Zap, Brain } from 'lucide-react';

interface ModelComparison {
  model: string;
  score: number;
  
  stability: number;
  interpretability: number;
  businessFit: number;
  reason: string;
  isRecommended?: boolean;
}

interface ModelComparisonReasoningProps {
  comparisons: ModelComparison[];
  reasoning: string;
  decisionFactors: {
    
    stabilityWeight: number;
    interpretabilityWeight: number;
    businessWeight: number;
  };
}

export const ModelComparisonReasoning: React.FC<ModelComparisonReasoningProps> = ({
  comparisons,
  reasoning,
  decisionFactors
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFactorIcon = (factor: string) => {
    switch (factor) {
      case '': return <TrendingUp className="h-3 w-3" />;
      case 'stability': return <Shield className="h-3 w-3" />;
      case 'interpretability': return <Brain className="h-3 w-3" />;
      case 'business': return <Zap className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-600" />
          Model Selection Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Decision Factors Weights */}
        <div className="bg-white rounded-lg p-3 border">
          <div className="text-sm font-medium mb-2">Decision Criteria Weights:</div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1">
              {getFactorIcon('')}
              <span>Accuracy: {decisionFactors.Weight.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              {getFactorIcon('stability')}
              <span>Stability: {decisionFactors.stabilityWeight.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              {getFactorIcon('interpretability')}
              <span>Clarity: {decisionFactors.interpretabilityWeight.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              {getFactorIcon('business')}
              <span>Business: {decisionFactors.businessWeight.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Model Comparisons */}
        <div className="space-y-2">
          {comparisons.map((comparison, index) => (
            <div
              key={comparison.model}
              className={`p-3 rounded-lg border ${
                comparison.isRecommended 
                  ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' 
                  : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {comparison.isRecommended && <Star className="h-4 w-4 text-yellow-500" />}
                  <span className="font-medium">{comparison.model}</span>
                  <Badge variant={comparison.isRecommended ? "default" : "outline"} 
                         className={`text-xs ${getScoreColor(comparison.score)}`}>
                    {comparison.score.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                <div className="flex items-center gap-1">
                  {getFactorIcon('')}
                  <span className={getScoreColor(comparison.)}>
                    {comparison..toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {getFactorIcon('stability')}
                  <span className={getScoreColor(comparison.stability)}>
                    {comparison.stability.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {getFactorIcon('interpretability')}
                  <span className={getScoreColor(comparison.interpretability)}>
                    {comparison.interpretability.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {getFactorIcon('business')}
                  <span className={getScoreColor(comparison.businessFit)}>
                    {comparison.businessFit.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-slate-600">{comparison.reason}</p>
            </div>
          ))}
        </div>

        {/* Overall Reasoning */}
        <div className="bg-white rounded-lg p-3 border">
          <div className="text-sm font-medium mb-1">Decision Summary:</div>
          <p className="text-sm text-slate-700 leading-relaxed">{reasoning}</p>
        </div>
      </CardContent>
    </Card>
  );
};
