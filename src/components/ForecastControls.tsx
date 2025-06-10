import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';

interface ForecastControlsProps {
  skus: string[];
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
  results: ForecastResult[];
  descriptions?: Record<string, string>;
}

export const ForecastControls: React.FC<ForecastControlsProps> = ({
  skus,
  selectedSKU,
  onSKUChange,
  results,
  descriptions
}) => {
  const { toast } = useToast();
  
  const currentIndex = skus.indexOf(selectedSKU);
  
  const handlePrevSKU = () => {
    if (currentIndex > 0) {
      onSKUChange(skus[currentIndex - 1]);
    }
  };
  
  const handleNextSKU = () => {
    if (currentIndex < skus.length - 1) {
      onSKUChange(skus[currentIndex + 1]);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;

    // Create CSV content
    const headers = ['SKU', 'Model', 'Date', 'Predicted Value', 'Accuracy %'];
    const rows = results.flatMap(result => 
      result.predictions.map(prediction => [
        result.sku,
        result.model,
        prediction.date,
        prediction.value,
        result.accuracy?.toFixed(1) || 'N/A'
      ])
    );

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forecast_results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Forecast results have been downloaded as CSV",
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Select SKU:
        </label>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrevSKU}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={selectedSKU} onValueChange={onSKUChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select SKU">
                {selectedSKU ? (() => {
                  const desc = descriptions?.[selectedSKU];
                  return desc ? `${selectedSKU} - ${desc}` : selectedSKU;
                })() : ''}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {skus.map(sku => {
                const desc = descriptions?.[sku];
                return (
                  <SelectItem key={sku} value={sku}>
                    {desc ? `${sku} - ${desc}` : sku}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleNextSKU}
            disabled={currentIndex === skus.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Button variant="outline" onClick={exportResults}>
        <Download className="h-4 w-4 mr-2" />
        Export CSV
      </Button>
    </div>
  );
};
