import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { ForecastResult } from '@/pages/Index';
import { useToast } from '@/hooks/use-toast';
import { useSKUStore } from '@/store/skuStore';

export const ForecastControls: React.FC = () => {
  const { toast } = useToast();
  
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);
  
  const currentIndex = useSKUStore(state => state.skus.indexOf(state.selectedSKU));
  
  const handlePrevSKU = () => {
    if (currentIndex > 0) {
      setSelectedSKU(useSKUStore(state => state.skus[currentIndex - 1]));
    }
  };
  
  const handleNextSKU = () => {
    if (currentIndex < useSKUStore(state => state.skus.length) - 1) {
      setSelectedSKU(useSKUStore(state => state.skus[currentIndex + 1]));
    }
  };

  const exportResults = () => {
    const results = useSKUStore(state => state.results);
    if (results.length === 0) return;

    // Create CSV content
    const headers = ['SKU', 'Model', 'Date', 'Predicted Value', 'Performance'];
    const rows = results.flatMap(result => 
      result.predictions.map(prediction => [
        result.sku,
        result.model,
        prediction.date,
        prediction.value,
        result.?.toFixed(1) || 'N/A'
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
          <Select value={selectedSKU} onValueChange={setSelectedSKU}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select SKU">
                {selectedSKU ? (() => {
                  const desc = useSKUStore(state => state.descriptions?.[selectedSKU]);
                  return desc ? `${selectedSKU} - ${desc}` : selectedSKU;
                })() : ''}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {useSKUStore(state => state.skus).map(sku => {
                const desc = useSKUStore(state => state.descriptions?.[sku]);
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
            disabled={currentIndex === useSKUStore(state => state.skus.length) - 1}
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
