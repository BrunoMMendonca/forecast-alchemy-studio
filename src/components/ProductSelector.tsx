import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Product (SKU)</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={onSKUChange} defaultValue={selectedSKU}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select SKU" />
          </SelectTrigger>
          <SelectContent>
            {skus.map((sku) => (
              <SelectItem key={sku} value={sku}>
                {sku}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};
