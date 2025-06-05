import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, ChevronDown, ChevronUp, Info, Grid3x3, Shield } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ReasoningDisplayProps {
  reasoning: string;
  confidence: number;
  method: string;
  expectedAccuracy?: number;
  factors?: {
    stability?: number;
    interpretability?: number;
    complexity?: number;
    businessImpact?: string;
  };
  title?: string;
  compact?: boolean;
}

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  reasoning,
  confidence,
  method,
  expectedAccuracy,
  factors,
  title = "Optimization Reasoning",
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(!compact);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getMethodIcon = (method: string) => {
    if (method.startsWith('ai_')) return <Bot className="h-4 w-4" />;
    if (method === 'grid_search') return <Grid3x3 className="h-4 w-4" />;
    if (method === 'fallback') return <Shield className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'ai_optimal': return 'AI Optimal';
      case 'ai_tolerance': return 'AI Tolerance';
      case 'ai_confidence': return 'AI Confidence';
      case 'grid_search': return 'Grid Search';
      case 'fallback': return 'Fallback';
      default: return method.replace('_', ' ');
    }
  };

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="border rounded-lg p-3 bg-slate-50">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto font-normal">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">View Reasoning</span>
                <Badge variant="outline" className={`text-xs ${getConfidenceColor(confidence)}`}>
                  {confidence}% confident
                </Badge>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {getMethodIcon(method)}
                <span className="font-medium">Method:</span>
                <span className="capitalize">{getMethodLabel(method)}</span>
                {expectedAccuracy && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span>Expected: {expectedAccuracy.toFixed(1)}% accuracy</span>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{reasoning}</p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {getMethodIcon(method)}
          {title}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {getMethodIcon(method)}
            <span className="capitalize">{getMethodLabel(method)}</span>
          </div>
          <Badge variant="outline" className={getConfidenceColor(confidence)}>
            {confidence}% confidence
          </Badge>
          {expectedAccuracy && (
            <Badge variant="secondary">
              {expectedAccuracy.toFixed(1)}% expected accuracy
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-slate-700 leading-relaxed">{reasoning}</p>
        </div>

        {factors && (
          <div className="grid grid-cols-2 gap-3">
            {factors.stability !== undefined && (
              <div className="bg-white rounded p-3 border">
                <div className="text-xs text-slate-500 mb-1">Stability Score</div>
                <div className="text-lg font-semibold text-blue-600">{factors.stability}%</div>
              </div>
            )}
            {factors.interpretability !== undefined && (
              <div className="bg-white rounded p-3 border">
                <div className="text-xs text-slate-500 mb-1">Interpretability</div>
                <div className="text-lg font-semibold text-green-600">{factors.interpretability}%</div>
              </div>
            )}
            {factors.complexity !== undefined && (
              <div className="bg-white rounded p-3 border">
                <div className="text-xs text-slate-500 mb-1">Complexity</div>
                <div className="text-lg font-semibold text-orange-600">{factors.complexity}%</div>
              </div>
            )}
            {factors.businessImpact && (
              <div className="bg-white rounded p-3 border col-span-2">
                <div className="text-xs text-slate-500 mb-1">Business Impact</div>
                <div className="text-sm text-slate-700">{factors.businessImpact}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
