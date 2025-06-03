
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SalesData } from '@/pages/Index';

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

  return (
    <div className="space-y-2">
      <Label htmlFor="sku-select" className="text-sm font-medium text-slate-700">
        Select Product/SKU
      </Label>
      <Select value={selectedSKU} onValueChange={onSKUChange}>
        <SelectTrigger id="sku-select" className="w-full">
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
    </div>
  );
};
