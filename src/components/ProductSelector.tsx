
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
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
  
  const getSkuStats = (sku: string) => {
    const skuData = data.filter(d => d.sku === sku);
    const total = skuData.reduce((sum, d) => sum + d.sales, 0);
    const avg = total / skuData.length;
    return { dataPoints: skuData.length, avgSales: avg };
  };

  const selectedStats = selectedSKU ? getSkuStats(selectedSKU) : null;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Select Product for Forecasting
        </CardTitle>
        <CardDescription>
          Choose the product/SKU you want to optimize and generate forecasts for
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Product/SKU</label>
          <Select value={selectedSKU} onValueChange={onSKUChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a product to forecast" />
            </SelectTrigger>
            <SelectContent>
              {skus.map(sku => {
                const stats = getSkuStats(sku);
                return (
                  <SelectItem key={sku} value={sku}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{sku}</span>
                      <div className="flex gap-1 ml-2">
                        <Badge variant="outline" className="text-xs">
                          {stats.dataPoints} points
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          avg: {stats.avgSales.toFixed(0)}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedSKU && selectedStats && (
          <div className="p-3 bg-white rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">Selected: {selectedSKU}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Data Points:</span>
                <span className="font-medium ml-2">{selectedStats.dataPoints}</span>
              </div>
              <div>
                <span className="text-slate-600">Avg Sales:</span>
                <span className="font-medium ml-2">{selectedStats.avgSales.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
