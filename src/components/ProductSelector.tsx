import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SalesData } from '@/types/sales';

interface ProductSelectorProps {
  data: SalesData[];
  selectedSKU: string;
  onSKUChange: (sku: string) => void;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  data,
  selectedSKU,
  onSKUChange
}) => {
  const skus = Array.from(new Set(data.map(d => d.sku))).sort();
  
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

  return (
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
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a product to forecast" />
          </SelectTrigger>
          <SelectContent>
            {skus.map(sku => (
              <SelectItem key={sku} value={sku}>
                {sku}
              </SelectItem>
            ))}
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
  );
};
