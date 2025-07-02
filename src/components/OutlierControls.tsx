import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSKUStore } from '@/store/skuStore';

interface OutlierControlsProps {
  skus: string[];
  threshold: number[];
  onThresholdChange: (threshold: number[]) => void;
  treatZeroAsOutlier: boolean;
  setTreatZeroAsOutlier: (checked: boolean) => void;
  descriptions?: Record<string, string>;
}

export const OutlierControls: React.FC<OutlierControlsProps> = ({
  skus,
  threshold,
  onThresholdChange,
  treatZeroAsOutlier,
  setTreatZeroAsOutlier,
  descriptions
}) => {
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  const currentIndex = skus.indexOf(selectedSKU);
  const handlePrevSKU = () => {
    if (currentIndex > 0) {
      setSelectedSKU(skus[currentIndex - 1]);
    }
  };
  const handleNextSKU = () => {
    if (currentIndex < skus.length - 1) {
      setSelectedSKU(skus[currentIndex + 1]);
    }
  };

  return (
    <div className="flex justify-start">
      <div className="w-1/2">
        <div className="grid grid-cols-10 gap-4">
          <div className="col-span-7 space-y-2">
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
            <SelectTrigger className="flex-1">
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

          <div className="col-span-3 space-y-2">
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
        <div className="flex items-center space-x-2 mt-1">
          <input
            type="checkbox"
            id="treat-zero-as-outlier"
            checked={treatZeroAsOutlier}
            onChange={e => setTreatZeroAsOutlier(e.target.checked)}
          />
          <label htmlFor="treat-zero-as-outlier" className="text-xs text-slate-700 cursor-pointer">
            Treat zeros as outliers
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Higher values = fewer outliers detected
        </p>
          </div>
        </div>
      </div>
    </div>
  );
};
