import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SalesData } from '@/types/forecast';
import { useSKUStore } from '@/store/skuStore';

interface ProductSelectorProps {
  data: SalesData[];
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({ data }) => {
  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  // Get unique SKUs from data using legacy fallback logic
  const skus = React.useMemo(() => {
    const uniqueSKUs = new Set<string>();
    
    data.forEach(item => {
      const sku = item.sku || item['Material Code'];
      if (sku) {
        uniqueSKUs.add(String(sku));
      }
    });
    return Array.from(uniqueSKUs).sort();
  }, [data]);
  
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

  // Helper to get description for a SKU
  const getDescription = (sku: string) => {
    const row = data.find(d => String(d.sku || d['Material Code']) === sku);
    return row?.Description ? String(row.Description) : '';
  };

  // Auto-select first SKU if none selected and we have SKUs
  React.useEffect(() => {
    if (!selectedSKU && skus.length > 0) {
      setSelectedSKU(skus[0]);
    }
  }, [selectedSKU, skus, setSelectedSKU]);

  if (skus.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          No SKUs available
        </label>
      </div>
    );
  }

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
        <Select 
          value={selectedSKU} 
          onValueChange={setSelectedSKU}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a product to forecast">
              {selectedSKU ? (() => {
                const desc = getDescription(selectedSKU);
                return desc ? `${selectedSKU} - ${desc}` : selectedSKU;
              })() : ''}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {skus.map(sku => {
              const desc = getDescription(sku);
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
  );
};
