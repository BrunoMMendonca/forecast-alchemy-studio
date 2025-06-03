
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface OutlierControlsProps {
  selectedSKU: string;
  skus: string[];
  threshold: number[];
  onSKUChange: (sku: string) => void;
  onThresholdChange: (threshold: number[]) => void;
  onPrevSKU: () => void;
  onNextSKU: () => void;
}

export const OutlierControls: React.FC<OutlierControlsProps> = ({
  selectedSKU,
  skus,
  threshold,
  onSKUChange,
  onThresholdChange,
  onPrevSKU,
  onNextSKU
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Select SKU:
        </label>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPrevSKU}
            disabled={skus.indexOf(selectedSKU) === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={selectedSKU} onValueChange={onSKUChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select SKU" />
            </SelectTrigger>
            <SelectContent>
              {skus.map(sku => (
                <SelectItem key={sku} value={sku}>{sku}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onNextSKU}
            disabled={skus.indexOf(selectedSKU) === skus.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Z-Score Threshold: {threshold[0]}
        </label>
        <Slider
          value={threshold}
          onValueChange={onThresholdChange}
          max={4}
          min={1}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-slate-500">
          Higher values = fewer outliers detected
        </p>
      </div>
    </div>
  );
};
