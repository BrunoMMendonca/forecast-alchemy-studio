import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Calendar, TrendingUp, MousePointer, Wand2, BarChart3, RotateCcw, CheckCircle } from 'lucide-react';
import { useForecastWizardStore } from '@/store/forecastWizardStore';
import { ForecastChart } from '../ForecastChart';

interface FinalizeStepProps {
  data: any[];
  forecastPeriods: number;
  onForecastGeneration: (results: any[], selectedSKU: string) => void;
  setForecastResults: (results: any[]) => void;
  processedDataInfo?: any;
  datasetId?: number;
}

export const FinalizeStep: React.FC<FinalizeStepProps> = ({
  data,
  forecastPeriods,
  onForecastGeneration,
  setForecastResults,
  processedDataInfo,
  datasetId
}) => {
  const { 
    optimizationResults, 
    manualAdjustments, 
    aiSuggestions, 
    finalizedForecast,
    addManualAdjustment,
    addAISuggestion,
    setFinalizedForecast 
  } = useForecastWizardStore();

  const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isApplyingAI, setIsApplyingAI] = useState<boolean>(false);

  // Mock forecast data for demonstration
  const mockForecastData = [
    { date: '2024-01', actual: 100, forecast: 105 },
    { date: '2024-02', actual: 120, forecast: 118 },
    { date: '2024-03', actual: 110, forecast: 112 },
    { date: '2024-04', actual: null, forecast: 115 },
    { date: '2024-05', actual: null, forecast: 120 },
    { date: '2024-06', actual: null, forecast: 125 },
  ];

  const handleManualAdjustment = () => {
    if (selectedPeriod.start && selectedPeriod.end && adjustmentValue !== 0) {
      const adjustment = {
        id: Date.now(),
        period: selectedPeriod,
        value: adjustmentValue,
        type: 'manual',
        timestamp: new Date().toISOString()
      };
      addManualAdjustment(adjustment);
      
      // Reset form
      setSelectedPeriod({ start: '', end: '' });
      setAdjustmentValue(0);
    }
  };

  const handleAIAdjustment = async () => {
    if (!aiPrompt.trim()) return;

    setIsApplyingAI(true);
    
    // Simulate AI processing
    setTimeout(() => {
      const suggestion = {
        id: Date.now(),
        prompt: aiPrompt,
        action: 'Reduce forecast by 10% for Q4',
        applied: true,
        timestamp: new Date().toISOString()
      };
      addAISuggestion(suggestion);
      setAiPrompt('');
      setIsApplyingAI(false);
    }, 2000);
  };

  const handleUndoAdjustment = (type: 'manual' | 'ai', id: number) => {
    // TODO: Implement undo logic
    console.log(`Undoing ${type} adjustment:`, id);
  };

  const handleFinalizeForecast = () => {
    // TODO: Generate final forecast with all adjustments applied
    const finalForecast = {
      id: Date.now(),
      data: mockForecastData,
      adjustments: [...manualAdjustments, ...aiSuggestions],
      confidence: 0.85,
      timestamp: new Date().toISOString()
    };
    setFinalizedForecast(finalForecast);
  };

  const getInteractiveChart = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Main Forecast Chart
          </CardTitle>
          <CardDescription>
            Interactive chart with draggable forecast points.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Chart Controls */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                <MousePointer className="h-4 w-4 mr-2" />
                Select Points
              </Button>
              <Button size="sm" variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Drag to Adjust
              </Button>
              <Button size="sm" variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Changes
              </Button>
            </div>

            {/* Chart Area */}
            <div className="h-80 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>Interactive forecast chart coming soon</p>
                <p className="text-sm">Drag points to adjust forecasts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getManualAdjustments = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MousePointer className="h-5 w-5 text-green-600" />
            Manual Adjustments
          </CardTitle>
          <CardDescription>
            Select periods and apply manual adjustments to the forecast.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adjustment Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={selectedPeriod.start}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={selectedPeriod.end}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Adjustment Value</label>
              <Input
                type="number"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                placeholder="0"
                className="mt-1"
              />
            </div>
          </div>

          <Button onClick={handleManualAdjustment} disabled={!selectedPeriod.start || !selectedPeriod.end}>
            Apply Adjustment
          </Button>

          {/* Recent Adjustments */}
          {manualAdjustments.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Recent Adjustments:</h4>
              {manualAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">
                    {adjustment.period.start} to {adjustment.period.end}: {adjustment.value}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUndoAdjustment('manual', adjustment.id)}
                  >
                    Undo
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const getAITuningPanel = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-600" />
            AI-Assisted Tuning
          </CardTitle>
          <CardDescription>
            Use natural language to adjust forecasts with AI assistance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Input */}
          <div>
            <label className="text-sm font-medium">Describe your adjustment</label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Set sales to zero for July-December"
              className="mt-1"
              rows={3}
            />
          </div>

          <Button 
            onClick={handleAIAdjustment} 
            disabled={!aiPrompt.trim() || isApplyingAI}
            className="flex items-center gap-2"
          >
            {isApplyingAI ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Apply AI Suggestion
              </>
            )}
          </Button>

          {/* Recent AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Recent Suggestions:</h4>
              {aiSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="p-3 bg-purple-50 rounded border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{suggestion.action}</p>
                      <p className="text-xs text-gray-600 mt-1">"{suggestion.prompt}"</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUndoAdjustment('ai', suggestion.id)}
                    >
                      Undo
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const getForecastSummary = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Forecast Summary
          </CardTitle>
          <CardDescription>
            Review final forecast metrics and complete the process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">1,250</div>
              <div className="text-sm text-blue-600">Total Forecast</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">85%</div>
              <div className="text-sm text-green-600">Confidence</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline">View Details</Button>
            <Button 
              onClick={handleFinalizeForecast}
              disabled={finalizedForecast !== null}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Finalize Forecast
            </Button>
          </div>

          {finalizedForecast && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Forecast finalized successfully!</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {getInteractiveChart()}
      {getManualAdjustments()}
      {getAITuningPanel()}
      {getForecastSummary()}
    </div>
  );
}; 