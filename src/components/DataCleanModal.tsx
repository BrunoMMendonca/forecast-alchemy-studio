import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutlierChart } from './OutlierChart';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { OutlierControls } from './OutlierControls';

export function DataCleanModal({
  open,
  onClose,
  selectedSKU,
  setSelectedSKU,
  threshold,
  setThreshold,
  treatZeroAsOutlier,
  setTreatZeroAsOutlier,
  cleanedData,
  originalData,
  highlightedDate,
  onDateClick,
  onSaveEdit,
}) {
  // Remove local state for selectedSKU, threshold, treatZeroAsOutlier
  const [selectedDate, setSelectedDate] = useState<string | null>(highlightedDate || null);
  const [editValue, setEditValue] = useState<number | null>(null);
  const [editNote, setEditNote] = useState<string>('');

  // Compute SKUs and descriptions from cleanedData
  const skus = React.useMemo(() => {
    return Array.from(new Set(cleanedData.map(d => String(d['Material Code'])))).sort() as string[];
  }, [cleanedData]);

  const descriptions = React.useMemo(() => {
    const map = {};
    cleanedData.forEach(d => {
      const sku = String(d['Material Code']);
      if (d.Description && !map[sku]) map[sku] = String(d.Description);
    });
    return map;
  }, [cleanedData]);

  // Compute filtered cleanedData for the selected SKU
  const filteredCleanedData = React.useMemo(() => {
    if (!selectedSKU || !cleanedData || cleanedData.length === 0) return [];
    return cleanedData.filter(d => d['Material Code'] === selectedSKU);
  }, [cleanedData, selectedSKU]);

  // Build chartData as in OutlierDetection: merge originalData and cleanedData for the selected SKU
  const effectiveCleanedData = cleanedData.length > 0 ? cleanedData : originalData;
  const chartData = React.useMemo(() => {
    if (!selectedSKU || !originalData || originalData.length === 0) return [];

    const originalSkuData = originalData.filter(d => d['Material Code'] === selectedSKU)
      .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
    const cleanedSkuData = effectiveCleanedData.filter(d => d['Material Code'] === selectedSKU)
      .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());

    // Calculate outlier detection for the selected SKU
    const skuData = effectiveCleanedData.filter(d => d['Material Code'] === selectedSKU);
    let outlierData: any[] = [];
    
    if (skuData.length >= 3) {
      const sales = skuData.map(d => d.Sales);
      const mean = sales.reduce((sum, s) => sum + s, 0) / sales.length;
      const variance = sales.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sales.length;
      const stdDev = Math.sqrt(variance);
      
      outlierData = skuData.map((item, index) => {
        const zScore = stdDev > 0 ? Math.abs((item.Sales - mean) / stdDev) : 0;
        const isZero = treatZeroAsOutlier && Number(item.Sales) === 0;
        const isOutlier = isZero || zScore > threshold[0];
        return {
          date: item['Date'],
          isOutlier,
          zScore
        };
      });
    } else {
      // For small datasets, treat zeros as outliers if enabled
      outlierData = skuData.map((item, index) => {
        const isZero = treatZeroAsOutlier && Number(item.Sales) === 0;
        return {
          date: item['Date'],
          isOutlier: isZero,
          zScore: 0
        };
      });
    }

    return originalSkuData.map((originalItem) => {
      const cleanedItem = cleanedSkuData.find(c => c['Date'] === originalItem['Date']);
      const outlierItem = outlierData.find(o => o.date === originalItem['Date']);
      return {
        date: originalItem['Date'],
        originalSales: originalItem.Sales,
        cleanedSales: cleanedItem?.Sales ?? originalItem.Sales,
        outlier: outlierItem?.isOutlier ? originalItem.Sales : null
      };
    });
  }, [originalData, effectiveCleanedData, selectedSKU, threshold, treatZeroAsOutlier]);

  // When SKU or chart data changes, select the data point with the largest outlier z-score
  useEffect(() => {
    if (chartData.length > 0) {
      // Find the data point with the largest z-score (prefer outliers)
      let maxZ = -Infinity;
      let maxIdx = 0;
      chartData.forEach((d, i) => {
        if (d.cleanedSales && d.cleanedSales > maxZ) {
          maxZ = d.cleanedSales;
          maxIdx = i;
        }
      });
      // If there are outliers, select the one with the largest z-score
      if (maxZ > -Infinity) {
        setSelectedDate(chartData[maxIdx].date);
      } else {
        // If no outliers, select the first data point
        setSelectedDate(chartData[0].date);
      }
    } else {
      setSelectedDate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSKU, chartData]);

  // Find the selected data point for the chart (filtered)
  const dataPoint = chartData.find(d => d.date === selectedDate);
  useEffect(() => {
    if (dataPoint) {
      setEditValue(dataPoint.cleanedSales ?? null);
      setEditNote(dataPoint.note ?? '');
    }
  }, [dataPoint]);

  // Find the original sales value from filteredCleanedData
  const originalDataPoint = filteredCleanedData.find(d => d['Date'] === selectedDate);
  const originalSales = originalDataPoint?.Sales ?? dataPoint?.originalSales ?? '';

  // Save handler
  const handleSave = () => {
    if (selectedDate && editValue !== null) {
      onSaveEdit(selectedDate, editValue, editNote);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent fullscreen>
        <DialogHeader className="p-6 m-6">
          <DialogTitle className="text-3xl font-bold">Clean & Prepare (Expanded View)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col flex-grow h-full min-h-0 p-8">
          {/* Controls at the top */}
          <div className="mb-6">
            <OutlierControls
              skus={skus}
              threshold={threshold}
              onThresholdChange={setThreshold}
              treatZeroAsOutlier={treatZeroAsOutlier}
              setTreatZeroAsOutlier={setTreatZeroAsOutlier}
              descriptions={descriptions}
            />
          </div>
          {/* Chart fills available space */}
          <div className="flex-grow min-h-0 flex flex-col">
            <div className="w-full h-full flex-grow min-h-0">
              {chartData && chartData.length > 0 ? (
                <OutlierChart
                  data={chartData}
                  selectedSKU={selectedSKU}
                  onDateClick={date => {
                    setSelectedDate(date);
                    if (onDateClick) onDateClick(date);
                  }}
                  highlightedDate={selectedDate || undefined}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No chart data available</p>
                </div>
              )}
            </div>
          </div>
          {/* Edit table stays at the bottom */}
          <div className="border-t mt-6 pt-6">
            {dataPoint ? (
              <>
                <div className="mb-2 font-semibold">
                  {dataPoint.date} &nbsp; Current: {dataPoint.cleanedSales} (Original: {originalSales})
                </div>
                <div className="flex gap-4 items-start">
                  <div className="basis-1/5 min-w-0 flex flex-col">
                    <label className="block text-xs mb-1">New Value</label>
                    <Input
                      className="border border-blue-400 h-10"
                      type="number"
                      value={editValue ?? ''}
                      onChange={e => setEditValue(Number(e.target.value))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                    />
                  </div>
                  <div className="basis-4/5 min-w-0 flex flex-col">
                    <label className="block text-xs mb-1">Note (optional)</label>
                    <Textarea
                      className="border border-blue-400 h-10 resize-none"
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      rows={1}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center ml-auto">
                    <label className="block text-xs mb-1 invisible">Save</label>
                    <Button onClick={handleSave} className="h-10">Save</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-center mt-8">
                Click a data point in the chart to edit.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 