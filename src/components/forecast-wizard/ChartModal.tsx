import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { EnhancedModelDiagnosticChart } from './EnhancedModelDiagnosticChart';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  modelName: string;
  historicalData: Array<{
    date: string;
    value: number;
  }>;
  forecastData: Array<{
    date: string;
    value: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  datasetId: number;
  sku: string;
  onPeriodChange?: (period: number) => void;
  selectedPeriod?: number;
  forecastPeriods?: number[];
  onGenerateMultiplePeriods?: (modelId: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export const ChartModal: React.FC<ChartModalProps> = ({
  isOpen,
  onClose,
  modelId,
  modelName,
  historicalData,
  forecastData,
  datasetId,
  sku,
  onPeriodChange,
  selectedPeriod = 12,
  forecastPeriods = [6, 12, 24],
  onGenerateMultiplePeriods,
  isLoading = false,
  error = null
}) => {
  const handlePeriodChange = (value: string) => {
    const period = parseInt(value);
    onPeriodChange?.(period);
  };

  const handleGenerateMultiplePeriods = () => {
    onGenerateMultiplePeriods?.(modelId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold">
                {modelName} Forecast Analysis
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>SKU: {sku}</span>
                <span>•</span>
                <span>Dataset ID: {datasetId}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Period Selection and Controls */}
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Forecast Period:</span>
                <Select value={selectedPeriod.toString()} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {forecastPeriods.map(period => (
                      <SelectItem key={period} value={period.toString()}>
                        {period} months
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {onGenerateMultiplePeriods && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateMultiplePeriods}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Generate All Periods
                </Button>
              )}
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-2">
              {isLoading && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                  Generating...
                </Badge>
              )}
              {error && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Error
                </Badge>
              )}
              {!isLoading && !error && forecastData.length > 0 && (
                <Badge variant="default" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Ready
                </Badge>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Forecast Generation Error</span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          )}
        </DialogHeader>
        
        <EnhancedModelDiagnosticChart
          modelId={modelId}
          modelName={modelName}
          historicalData={historicalData}
          forecastData={forecastData}
          datasetId={datasetId}
          sku={sku}
          onClose={onClose}
          selectedPeriod={selectedPeriod}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}; 