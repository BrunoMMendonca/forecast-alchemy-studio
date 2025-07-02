import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertTriangle, TrendingUp, Calendar, Activity, Maximize2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NormalizedSalesData } from '@/pages/Index';
import { detectSeasonality, analyzeTrend, calculateVolatility, findCorrelations, findDateGaps, calculateCompleteness, countZeroValues, countMissingValues, countDateGaps } from '@/utils/dataAnalysis';
import { getBlueTone } from '@/utils/colors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSKUStore } from '@/store/skuStore';

interface DataVisualizationProps {
  data: NormalizedSalesData[];
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'overview' | 'details'>('overview');
  const [seasonalityMode, setSeasonalityMode] = useState<'average' | 'full'>('average');

  const skus = useMemo(() => {
    return Array.from(new Set(data.map(d => d['Material Code']))).sort();
  }, [data]);

  const descriptions = useMemo(() => {
    const map: Record<string, string> = {};
    data.forEach(d => {
      const sku = String(d['Material Code']);
      if (d.Description && !map[sku]) map[sku] = String(d.Description);
    });
    return map;
  }, [data]);

  const selectedSKU = useSKUStore(state => state.selectedSKU);
  const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

  const chartData = useMemo(() => {
    if (!selectedSKU) return [];
    
    return data
      .filter(d => d['Material Code'] === selectedSKU)
      .sort((a, b) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime())
      .map(d => ({ date: d['Date'], sales: d['Sales'] }));
  }, [data, selectedSKU]);

  // 1. Detect aggregatable fields (exclude fixed fields)
  const aggregatableFields = useMemo(() => {
    if (data.length === 0) return [];
    const exclude = new Set(['Material Code', 'Description', 'Date', 'Sales', 'note']);
    const fields = Object.keys(data[0]).filter(k => !exclude.has(k));
    return fields;
  }, [data]);

  // 2. Add state for selected aggregatable field
  const [selectedAggField, setSelectedAggField] = useState<string>('None');

  // Add state for selected value in the aggregatable field
  const [selectedAggValue, setSelectedAggValue] = useState<string>('All');

  // Get all unique values for the selected aggregatable field
  const aggFieldValues = useMemo(() => {
    if (!selectedAggField || selectedAggField === 'All portfolio') return [];
    return Array.from(new Set(data.map(d => d[selectedAggField]).filter(v => v !== undefined && v !== null))).sort();
  }, [data, selectedAggField]);

  // 3. Group and aggregate data by selected field (and date for time series)
  const aggregated = useMemo(() => {
    if (selectedAggField === 'All portfolio') {
      // Aggregate all sales by date (sum across all SKUs)
      const byDate: Record<string, number> = {};
      data.forEach(d => {
        if (d['Date'] && typeof d['Sales'] === 'number' && Number.isFinite(d['Sales'])) {
          byDate[d['Date']] = (byDate[d['Date']] || 0) + d['Sales'];
        }
      });
      return Object.entries(byDate).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime()).map(([date, sales]) => ({ date, sales }));
    } else {
      // Group by field and date
      const byFieldDate: Record<string, Record<string, number>> = {};
      data.forEach(d => {
        const field = d[selectedAggField] || 'Unknown';
        const date = d['Date'];
        if (!date || typeof d['Sales'] !== 'number' || !Number.isFinite(d['Sales'])) return;
        if (!byFieldDate[field]) byFieldDate[field] = {};
        byFieldDate[field][date] = (byFieldDate[field][date] || 0) + d['Sales'];
      });
      // Convert to array of { date, ...fields }
      const allDates = Array.from(new Set(data.map(d => d['Date']))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const allFields = Object.keys(byFieldDate);
      return allDates.map(date => {
        const row: any = { date };
        allFields.forEach(field => {
          row[field] = byFieldDate[field][date] || 0;
        });
        return row;
      });
    }
  }, [data, selectedAggField]);

  // Filter aggregated data by selected value if needed
  const filteredAggregated = useMemo(() => {
    if (!selectedAggField || selectedAggField === 'All portfolio' || selectedAggValue === 'All') {
      return aggregated;
    }
    // Only keep the selected value's series
    return aggregated.map(row => {
      return { date: row.date, [selectedAggValue]: row[selectedAggValue] || 0 };
    });
  }, [aggregated, selectedAggField, selectedAggValue]);

  // Helper: should we aggregate?
  const isAggregating = selectedAggField !== 'All portfolio' || selectedAggField === 'All portfolio';

  // Compute stats for aggregated data or SKU
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    let sales: number[] = [];
    if (selectedAggField === 'None') {
      // By SKU
    const filteredData = data.filter(d => d['Material Code'] === selectedSKU);
      sales = filteredData
        .map(d => d['Sales'])
        .filter(s => typeof s === 'number' && Number.isFinite(s));
    } else if (selectedAggField === 'All portfolio') {
      // Use aggregated (summed) series
      sales = (aggregated || []).map(d => d.sales).filter(s => typeof s === 'number' && Number.isFinite(s));
    } else if (selectedAggField && selectedAggField !== 'All portfolio') {
      if (selectedAggValue === 'All') {
        // Use aggregated (summed) series for all groups
        sales = (aggregated || []).reduce((arr, row) => {
          const sum = Object.keys(row)
            .filter(k => k !== 'date')
            .reduce((acc, k) => acc + (typeof row[k] === 'number' && Number.isFinite(row[k]) ? row[k] : 0), 0);
          arr.push(sum);
          return arr;
        }, [] as number[]);
      } else {
        // Only the selected value in the field
        sales = (aggregated || []).map(row => row[selectedAggValue] || 0).filter(s => typeof s === 'number' && Number.isFinite(s));
      }
    }
    const totalSales = sales.reduce((sum, s) => sum + s, 0);
    const avgSales = sales.length > 0 ? totalSales / sales.length : 0;
    const maxSales = sales.length > 0 ? Math.max(...sales) : 0;
    const minSales = sales.length > 0 ? Math.min(...sales) : 0;
    return {
      total: totalSales,
      average: avgSales,
      max: maxSales,
      min: minSales,
      records: sales.length
    };
  }, [data, selectedSKU, selectedAggField, selectedAggValue, aggregated]);

  // Advanced Analysis
  const analysis = useMemo(() => {
    if (!selectedSKU || data.length === 0) return null;

    const skuData = data.filter(d => d['Material Code'] === selectedSKU);
    const sales = skuData.map(d => d['Sales']);
    const dates = skuData.map(d => new Date(d['Date']));

    // Detect seasonality
    const seasonality = detectSeasonality(sales);
    
    // Analyze trend
    const trend = analyzeTrend(sales, dates);
    
    // Calculate volatility
    const volatility = calculateVolatility(sales, dates);
    
    // Find correlations with other SKUs
    const correlations = findCorrelations(data, selectedSKU);

    // Data quality metrics
    const dateGaps = findDateGaps(dates);
    const zeroValues = sales.filter(s => s === 0).length;
    const missingValues = sales.filter(s => s === null || s === undefined).length;

    return {
      seasonality,
      trend,
      volatility,
      correlations,
      quality: {
        dateGaps,
        zeroValues,
        missingValues,
        completeness: ((sales.length - missingValues) / sales.length) * 100
      }
    };
  }, [data, selectedSKU]);

  // --- Seasonality Data for Chart ---
  const skuData = data.filter(d => d['Material Code'] === selectedSKU);
  const sales = skuData.map(d => d['Sales']);
  const dates = skuData.map(d => new Date(d['Date']));

  // For average by month
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthlySales = new Array(12).fill(0);
  const monthlyCount = new Array(12).fill(0);
  skuData.forEach((d) => {
    const month = new Date(d['Date']).getMonth();
    monthlySales[month] += d['Sales'];
    monthlyCount[month]++;
  });
  const monthlyAverages = monthlySales.map((sum, i) => monthlyCount[i] > 0 ? sum / monthlyCount[i] : 0);
  const averageByMonthPattern = months.map((month, i) => ({ month, value: monthlyAverages[i] }));

  // For full time series (unique month-year)
  const monthYearMap: Record<string, number> = {};
  skuData.forEach((d) => {
    const date = new Date(d['Date']);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!(key in monthYearMap)) monthYearMap[key] = 0;
    monthYearMap[key] += d['Sales'];
  });
  // Count for each month-year
  const monthYearCount: Record<string, number> = {};
  skuData.forEach((d) => {
    const date = new Date(d['Date']);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!(key in monthYearCount)) monthYearCount[key] = 0;
    monthYearCount[key]++;
  });
  // Build array for chart
  const fullMonthYearPattern = Object.keys(monthYearMap)
    .sort((a, b) => {
      const [ay, am] = a.split('-').map(Number);
      const [by, bm] = b.split('-').map(Number);
      return ay !== by ? ay - by : am - bm;
    })
    .map((key) => {
      const [year, month] = key.split('-').map(Number);
      return {
        month: `${months[month]} ${year}`,
        value: monthYearMap[key] / monthYearCount[key]
      };
    });

  // --- Trend lines for aggregation ---
  // For 'All portfolio', compute trend line for aggregated sales
  const allPortfolioTrend = useMemo(() => {
    if (selectedAggField === 'All portfolio' && aggregated && aggregated.length > 0) {
      const sales = aggregated.map(d => d.sales);
      const dates = aggregated.map(d => new Date(d.date));
      const trend = analyzeTrend(sales, dates);
      // Merge trend.trendLine with aggregated by date
      return aggregated.map((row, i) => ({
        date: row.date,
        sales: row.sales,
        trend: trend.trendLine[i]?.trend ?? null
      }));
    }
    return null;
  }, [selectedAggField, aggregated]);

  // For group aggregations, compute trend line for each group
  const groupAggregatedTrend = useMemo(() => {
    if (
      selectedAggField &&
      selectedAggField !== 'None' &&
      selectedAggField !== 'All portfolio' &&
      filteredAggregated &&
      filteredAggregated.length > 0
    ) {
      // Get all group keys (fields)
      const groupKeys = Object.keys(filteredAggregated[0] || {}).filter(k => k !== 'date');
      // For each group, compute trend line
      const trendLines: Record<string, number[]> = {};
      groupKeys.forEach(group => {
        const series = filteredAggregated.map(row => row[group] ?? 0);
        const dates = filteredAggregated.map(row => new Date(row.date));
        const trend = analyzeTrend(series, dates);
        trendLines[group] = trend.trendLine.map(t => t.trend);
      });
      // Merge trend lines into chart data
      return filteredAggregated.map((row, i) => {
        const obj: any = { date: row.date };
        groupKeys.forEach(group => {
          obj[group] = row[group];
          obj[`${group}_trend`] = trendLines[group][i];
        });
        return obj;
      });
    }
    return null;
  }, [selectedAggField, filteredAggregated]);

  // Data Quality metrics for aggregation
  const dataQuality = useMemo(() => {
    if (selectedAggField === 'None') {
      // Use per-SKU logic (analysis.quality)
      return analysis?.quality;
    }
    // Aggregation: use filteredAggregated or aggregated
    let rows = selectedAggField === 'All portfolio' ? aggregated : filteredAggregated;
    if (!rows || rows.length === 0) return null;
    // For each row, sum all values except 'date'
    const values: number[] = [];
    const dates: Date[] = [];
    rows.forEach(row => {
      dates.push(new Date(row.date));
      Object.keys(row).forEach(key => {
        if (key !== 'date') {
          const v = row[key];
          if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
        }
      });
    });
    return {
      completeness: calculateCompleteness(values),
      dateGaps: countDateGaps(dates),
      zeroValues: countZeroValues(values),
      missingValues: countMissingValues(values)
    };
  }, [selectedAggField, analysis, aggregated, filteredAggregated]);

  // --- Volatility for aggregation ---
  const aggregatedVolatility = useMemo(() => {
    if (selectedAggField === 'All portfolio' && aggregated && aggregated.length > 0) {
      const sales = aggregated.map(d => d.sales);
      const dates = aggregated.map(d => new Date(d.date));
      const volatility = calculateVolatility(sales, dates);
      // Merge volatility.volatilityLine with aggregated by date
      return aggregated.map((row, i) => ({
        date: row.date,
        volatility: volatility.volatilityLine[i]?.volatility ?? null
      }));
    } else if (selectedAggField && selectedAggField !== 'None' && selectedAggField !== 'All portfolio' && aggregated && aggregated.length > 0) {
      // For group aggregation, sum all groups for each date
      const sales = aggregated.map(row => {
        return Object.keys(row)
          .filter(k => k !== 'date')
          .reduce((acc, k) => acc + (typeof row[k] === 'number' && Number.isFinite(row[k]) ? row[k] : 0), 0);
      });
      const dates = aggregated.map(row => new Date(row.date));
      const volatility = calculateVolatility(sales, dates);
      return aggregated.map((row, i) => ({
        date: row.date,
        volatility: volatility.volatilityLine[i]?.volatility ?? null
      }));
    }
    return null;
  }, [selectedAggField, aggregated]);

  // --- Per-group volatility for group aggregation ---
  const groupVolatility = useMemo(() => {
    if (
      selectedAggField &&
      selectedAggField !== 'None' &&
      selectedAggField !== 'All portfolio' &&
      filteredAggregated &&
      filteredAggregated.length > 0
    ) {
      // Get all group keys (fields)
      const groupKeys = Object.keys(filteredAggregated[0] || {}).filter(k => k !== 'date');
      // For each group, compute volatility line
      const volatilityLines: Record<string, number[]> = {};
      groupKeys.forEach(group => {
        const series = filteredAggregated.map(row => row[group] ?? 0);
        const dates = filteredAggregated.map(row => new Date(row.date));
        const volatility = calculateVolatility(series, dates);
        volatilityLines[group] = volatility.volatilityLine.map(t => t.volatility);
      });
      // Merge volatility lines into chart data
      return filteredAggregated.map((row, i) => {
        const obj: any = { date: row.date };
        groupKeys.forEach(group => {
          obj[group] = volatilityLines[group][i];
        });
        return obj;
      });
    }
    return null;
  }, [selectedAggField, filteredAggregated]);

  // --- Volatility chart data with sales ---
  const volatilityChartData = useMemo(() => {
    if (selectedAggField === 'All portfolio' && aggregated && aggregated.length > 0 && aggregatedVolatility) {
      // Merge sales and volatility for each date
      return aggregated.map((row, i) => ({
        date: row.date,
        sales: row.sales,
        volatility: aggregatedVolatility[i]?.volatility ?? null
      }));
    } else if (selectedAggField && selectedAggField !== 'None' && selectedAggField !== 'All portfolio' && groupVolatility && aggregated) {
      // For group aggregation, merge group sales and group volatility for each date
      return aggregated.map((row, i) => {
        const obj: any = { date: row.date, sales: Object.keys(row).filter(k => k !== 'date').reduce((acc, k) => acc + (typeof row[k] === 'number' && Number.isFinite(row[k]) ? row[k] : 0), 0) };
        // Add per-group volatility
        if (groupVolatility[i]) {
          Object.keys(groupVolatility[i]).forEach(k => {
            if (k !== 'date') obj[k] = groupVolatility[i][k];
          });
        }
        return obj;
      });
    } else if (selectedAggField === 'None' && analysis?.volatility?.volatilityLine) {
      // Per-SKU: merge actual and volatility
      return (analysis.volatility.volatilityLine || []).map((row, i) => ({
        ...row,
        actual: sales[i] ?? null
      }));
    }
    return [];
  }, [selectedAggField, aggregated, aggregatedVolatility, groupVolatility, analysis, sales]);

  const handlePrevSKU = () => {
    const currentIndex = skus.indexOf(selectedSKU);
    if (currentIndex > 0) {
      setSelectedSKU(skus[currentIndex - 1]);
    }
  };

  const handleNextSKU = () => {
    const currentIndex = skus.indexOf(selectedSKU);
    if (currentIndex < skus.length - 1) {
      setSelectedSKU(skus[currentIndex + 1]);
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No data to visualize. Please upload a CSV file first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aggregatable Field Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Aggregate by:</label>
        <Select value={selectedAggField} onValueChange={value => { setSelectedAggField(value); setSelectedAggValue('All'); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Aggregate by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">None</SelectItem>
            <SelectItem value="All portfolio">All portfolio</SelectItem>
            {aggregatableFields.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Extra dropdown for value selection */}
        {selectedAggField && selectedAggField !== 'All portfolio' && selectedAggField !== 'None' && (
          <>
            <label className="text-sm font-medium text-slate-700">Value:</label>
            <Select value={selectedAggValue} onValueChange={setSelectedAggValue}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {aggFieldValues.map(v => (
                  <SelectItem key={String(v)} value={String(v)}>{String(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Controls */}
      {selectedAggField === 'None' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center" style={{ maxWidth: '36rem' }}>
            <div className="space-y-2 flex-1 w-full min-w-0">
              <label className="text-sm font-medium text-slate-700">
            Select SKU:
          </label>
              <div className="flex items-center space-x-2 w-full">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevSKU}
              disabled={skus.indexOf(selectedSKU) === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={selectedSKU} onValueChange={setSelectedSKU}>
                  <SelectTrigger className="w-full">
                <SelectValue placeholder="Select SKU">
                  {selectedSKU ? (() => {
                    const desc = descriptions[selectedSKU];
                    return desc ? `${selectedSKU} - ${desc}` : selectedSKU;
                  })() : ''}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {skus.map(sku => {
                  const desc = descriptions[sku];
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
              disabled={skus.indexOf(selectedSKU) === skus.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </div>
      </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex justify-end">
        <Button
          variant={viewMode === 'overview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('overview')}
          className="mr-2"
        >
          Overview
        </Button>
        <Button
          variant={viewMode === 'details' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('details')}
        >
          Detailed Analysis
        </Button>
      </div>

      {viewMode === 'overview' ? (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-sm text-blue-600 font-medium">SKUs</div>
              <div className="text-lg font-bold text-blue-800">
                {skus.length.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-sm text-slate-600 font-medium">Records</div>
              <div className="text-lg font-bold text-slate-800">
                {stats.records.toLocaleString()}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-sm text-blue-600 font-medium">Total Sales</div>
              <div className="text-lg font-bold text-blue-800">
                {stats.total.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-sm text-green-600 font-medium">Average</div>
              <div className="text-lg font-bold text-green-800">
                {stats.average.toFixed(1)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-sm text-purple-600 font-medium">Maximum</div>
              <div className="text-lg font-bold text-purple-800">
                {stats.max.toLocaleString()}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-sm text-orange-600 font-medium">Minimum</div>
              <div className="text-lg font-bold text-orange-800">
                {stats.min.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Main Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                {selectedAggField === 'None'
                  ? `Actual - ${selectedSKU}`
                  : selectedAggField === 'All portfolio'
                  ? 'Actual - All Portfolio'
                  : selectedAggField
                  ? `Actual by ${selectedAggField} - ${selectedAggValue}`
                  : `Actual - ${selectedSKU}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedAggField && selectedAggField !== 'None' ? filteredAggregated : chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={value => {
                        try {
                          const date = new Date(value);
                          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                        } catch {
                          return value;
                        }
                      }}
                    />
                    <YAxis 
                      domain={[
                        (dataMin: number) => Math.max(0, dataMin * 0.9),
                        (dataMax: number) => dataMax * 1.1
                      ]}
                      tickFormatter={value => Math.round(value).toLocaleString()}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (selectedAggField === 'None' || selectedAggField === 'All portfolio') {
                          return [value, 'Actual'];
                        } else if (selectedAggField && selectedAggValue === 'All') {
                          return [value, `${selectedAggField} (Actual)`];
                        } else if (selectedAggField && selectedAggValue) {
                          return [value, `${selectedAggValue} (Actual)`];
                        }
                        return [value, name];
                      }}
                      labelFormatter={label => {
                        try {
                          const date = new Date(label);
                          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                        } catch {
                          return label;
                        }
                      }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                    {selectedAggField && selectedAggField !== 'All portfolio' && selectedAggField !== 'None'
                      ? (selectedAggValue === 'All'
                        ? Object.keys(filteredAggregated[0] || {}).filter(k => k !== 'date').map((field, idx) => (
                    <Line 
                              key={field}
                              type="monotone"
                              dataKey={field}
                              stroke={getBlueTone(idx, aggFieldValues.length)}
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                              activeDot={false}
                              className="no-dot"
                            />
                          ))
                        : <Line
                            type="monotone"
                            dataKey={selectedAggValue}
                            stroke={getBlueTone(0, aggFieldValues.length)}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                            activeDot={false}
                            className="no-dot"
                          />
                      )
                      : <Line
                      type="monotone" 
                      dataKey="sales" 
                          stroke={getBlueTone(0, aggFieldValues.length)}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                          activeDot={false}
                          className="no-dot"
                    />
                    }
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Advanced Analysis with Aggregation Support */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seasonality Analysis */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Seasonality Analysis
                </CardTitle>
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant={seasonalityMode === 'average' ? 'default' : 'outline'}
                    onClick={() => setSeasonalityMode('average')}
                    className="px-2 py-0.5 text-xs h-6 min-h-0"
                  >
                    Average by Month
                  </Button>
                  <Button
                    size="sm"
                    variant={seasonalityMode === 'full' ? 'default' : 'outline'}
                    onClick={() => setSeasonalityMode('full')}
                    className="px-2 py-0.5 text-xs h-6 min-h-0"
                  >
                    Show All Months
                  </Button>
                </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="ml-auto">
                      <Maximize2 className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        Seasonality Analysis
                      </DialogTitle>
                    </DialogHeader>
                    <div className="h-[60vh]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          if (selectedAggField === 'All portfolio') {
                            // Aggregate: use aggregated (date, sales)
                            if (seasonalityMode === 'average') {
                              // Average by month
                              const monthMap = new Array(12).fill(0);
                              const monthCount = new Array(12).fill(0);
                              (aggregated || []).forEach(row => {
                                const date = new Date(row.date);
                                const month = date.getMonth();
                                monthMap[month] += row.sales;
                                monthCount[month]++;
                              });
                              const months = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                              ];
                              return months.map((m, i) => ({ month: m, value: monthCount[i] > 0 ? monthMap[i] / monthCount[i] : 0 }));
                            } else {
                              // Full mode: show all months/years
                              return (aggregated || []).map(row => {
                                const date = new Date(row.date);
                                const month = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                                return { month, value: row.sales };
                              });
                            }
                          } else if (selectedAggField !== 'None') {
                            // Group aggregation
                            if (seasonalityMode === 'average') {
                              const monthMap: Record<string, number[]> = {};
                              (filteredAggregated || []).forEach(row => {
                                const date = new Date(row.date);
                                const month = date.getMonth();
                                Object.keys(row).forEach(key => {
                                  if (key === 'date') return;
                                  if (!monthMap[key]) monthMap[key] = new Array(12).fill(0);
                                  monthMap[key][month] += row[key];
                                });
                              });
                              const months = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                              ];
                              return months.map((m, i) => {
                                const obj: any = { month: m };
                                Object.keys(monthMap).forEach(f => {
                                  obj[f] = monthMap[f][i];
                                });
                                return obj;
                              });
                            } else {
                              return (filteredAggregated || []).map(row => {
                                const date = new Date(row.date);
                                const month = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                                const obj: any = { month };
                                Object.keys(row).forEach(key => {
                                  if (key !== 'date') obj[key] = row[key];
                                });
                                return obj;
                              });
                            }
                          } else {
                            // Per-SKU logic
                            return seasonalityMode === 'average' ? averageByMonthPattern : fullMonthYearPattern;
                          }
                        })()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          interval={seasonalityMode === 'average' ? 0 : 'preserveStartEnd'}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                          tickFormatter={value => {
                            // Robustly format 'Month YYYY' as 'MMM YY'
                            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                            const parts = String(value).split(' ');
                            if (parts.length === 2) {
                              const [monthName, year] = parts;
                              const monthIndex = months.indexOf(monthName);
                              if (monthIndex !== -1 && !isNaN(Number(year))) {
                                const date = new Date(Number(year), monthIndex, 1);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              }
                            }
                            return value;
                          }}
                        />
                        <YAxis />
                        <Tooltip
                          formatter={(value, name, props) => {
                            let displayValue = value;
                            if (seasonalityMode === 'average' && typeof value === 'number') {
                              displayValue = value.toFixed(1);
                            } else if (seasonalityMode !== 'average' && typeof value === 'number') {
                              displayValue = value.toLocaleString();
                            }
                            if (selectedAggField === 'None' || selectedAggField === 'All portfolio') {
                              return [displayValue, 'Actual'];
                            } else if (selectedAggField && selectedAggValue === 'All') {
                              return [displayValue, `${selectedAggField} (Actual)`];
                            } else if (selectedAggField && selectedAggValue) {
                              return [displayValue, `${selectedAggValue} (Actual)`];
                            }
                            return [displayValue, name];
                          }}
                          labelFormatter={label => {
                            // Try to parse as a month name (average view)
                            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                            if (months.includes(label)) {
                              return label;
                            }
                            // Try to parse as a date (all months view)
                            try {
                              const [monthName, year] = label.split(' ');
                              if (monthName && year) {
                                const date = new Date(`${monthName} 1, 20${year.length === 2 ? year : year.slice(-2)}`);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              }
                              const date = new Date(label);
                              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                            } catch {
                              return label;
                            }
                          }}
                        />
                          {selectedAggField === 'All portfolio'
                            ? <Bar dataKey="value" fill={getBlueTone(0, aggFieldValues.length)} />
                            : selectedAggField !== 'None'
                              ? (selectedAggValue === 'All'
                                ? aggFieldValues.map((field, idx) => (
                                    <Bar key={field} dataKey={field} fill={getBlueTone(idx, aggFieldValues.length)} />
                                  ))
                                : <Bar dataKey={selectedAggValue} fill={getBlueTone(0, aggFieldValues.length)} />)
                              : <Bar dataKey="value" fill={getBlueTone(0, aggFieldValues.length)} />
                          }
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(() => {
                        if (selectedAggField === 'All portfolio') {
                          // Aggregate: use aggregated (date, sales)
                          if (seasonalityMode === 'average') {
                            // Average by month
                            const monthMap = new Array(12).fill(0);
                            const monthCount = new Array(12).fill(0);
                            (aggregated || []).forEach(row => {
                              const date = new Date(row.date);
                              const month = date.getMonth();
                              monthMap[month] += row.sales;
                              monthCount[month]++;
                            });
                            const months = [
                              'January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            return months.map((m, i) => ({ month: m, value: monthCount[i] > 0 ? monthMap[i] / monthCount[i] : 0 }));
                          } else {
                            // Full mode: show all months/years
                            return (aggregated || []).map(row => {
                              const date = new Date(row.date);
                              const month = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
                              return { month, value: row.sales };
                            });
                          }
                        } else if (selectedAggField !== 'None') {
                          // Group aggregation
                          if (seasonalityMode === 'average') {
                            const monthMap: Record<string, number[]> = {};
                            (filteredAggregated || []).forEach(row => {
                              const date = new Date(row.date);
                              const month = date.getMonth();
                              Object.keys(row).forEach(key => {
                                if (key === 'date') return;
                                if (!monthMap[key]) monthMap[key] = new Array(12).fill(0);
                                monthMap[key][month] += row[key];
                              });
                            });
                            const months = [
                              'January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            return months.map((m, i) => {
                              const obj: any = { month: m };
                              Object.keys(monthMap).forEach(f => {
                                obj[f] = monthMap[f][i];
                              });
                              return obj;
                            });
                          } else {
                            return (filteredAggregated || []).map(row => {
                              const date = new Date(row.date);
                              const month = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
                              const obj: any = { month };
                              Object.keys(row).forEach(key => {
                                if (key !== 'date') obj[key] = row[key];
                              });
                              return obj;
                            });
                          }
                        } else {
                          // Per-SKU logic (existing)
                          return seasonalityMode === 'average' ? averageByMonthPattern : fullMonthYearPattern;
                        }
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          interval={seasonalityMode === 'average' ? 0 : 'preserveStartEnd'}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis />
                        <Tooltip
                          formatter={(value, name, props) => {
                            let displayValue = value;
                            if (seasonalityMode === 'average' && typeof value === 'number') {
                              displayValue = value.toFixed(1);
                            } else if (seasonalityMode !== 'average' && typeof value === 'number') {
                              displayValue = value.toLocaleString();
                            }
                            if (selectedAggField === 'None' || selectedAggField === 'All portfolio') {
                              return [displayValue, 'Actual'];
                            } else if (selectedAggField && selectedAggValue === 'All') {
                              return [displayValue, `${selectedAggField} (Actual)`];
                            } else if (selectedAggField && selectedAggValue) {
                              return [displayValue, `${selectedAggValue} (Actual)`];
                            }
                            return [displayValue, name];
                          }}
                          labelFormatter={label => {
                            // Robustly format 'Month YYYY' as 'MMM YY'
                            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                            const parts = String(label).split(' ');
                            if (parts.length === 2) {
                              const [monthName, year] = parts;
                              const monthIndex = months.indexOf(monthName);
                              if (monthIndex !== -1 && !isNaN(Number(year))) {
                                const date = new Date(Number(year), monthIndex, 1);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              }
                            }
                            return label;
                          }}
                        />
                        {selectedAggField === 'All portfolio'
                          ? <Bar dataKey="value" fill={getBlueTone(0, aggFieldValues.length)} />
                          : selectedAggField !== 'None'
                            ? (selectedAggValue === 'All'
                              ? aggFieldValues.map((field, idx) => (
                                  <Bar key={field} dataKey={field} fill={getBlueTone(idx, aggFieldValues.length)} />
                                ))
                              : <Bar dataKey={selectedAggValue} fill={getBlueTone(0, aggFieldValues.length)} />)
                            : <Bar dataKey="value" fill={getBlueTone(0, aggFieldValues.length)} />
                        }
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>
              </CardContent>
            </Card>

            {/* Trend Analysis */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Trend Analysis
                </CardTitle>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="ml-auto">
                      <Maximize2 className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Trend Analysis
                      </DialogTitle>
                    </DialogHeader>
                    <div className="h-[60vh]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={
                          selectedAggField === 'All portfolio'
                            ? allPortfolioTrend || []
                            : selectedAggField !== 'None'
                              ? groupAggregatedTrend || []
                              : (analysis?.trend?.trendLine || [])
                        }>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            interval="preserveStartEnd"
                            angle={-30}
                            textAnchor="end"
                            height={60}
                            tickFormatter={(value) => {
                              try {
                                const date = new Date(value);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return value;
                              }
                            }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => {
                              if (name === 'trend' || name === 'volatility') {
                                return [Number(value).toFixed(1), name];
                              }
                              if (typeof value === 'number') {
                                return [value.toLocaleString(), name];
                              }
                              return [value, name];
                            }}
                            labelFormatter={label => {
                              try {
                                const date = new Date(label);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return label;
                              }
                            }}
                          />
                          {selectedAggField === 'All portfolio' ? (
                            <>
                              <Line type="monotone" dataKey="sales" stroke={getBlueTone(0, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                              <Line type="monotone" dataKey="trend" stroke={getBlueTone(1, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                            </>
                          ) : selectedAggField !== 'None' ? (
                            selectedAggValue === 'All'
                              ? aggFieldValues.map((field, idx) => [
                                  <Line
                                    key={field}
                                    type="monotone"
                                    dataKey={field}
                                    stroke={getBlueTone(idx, aggFieldValues.length)}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    activeDot={false}
                                    className="no-dot"
                                  />,
                                  <Line
                                    key={field + '_trend'}
                                    type="monotone"
                                    dataKey={`${field}_trend`}
                                    stroke={getBlueTone(idx + 1, aggFieldValues.length)}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    strokeDasharray="6 3"
                                    activeDot={false}
                                    className="no-dot"
                                  />
                                ])
                              : [
                                  <Line
                                    key={selectedAggValue}
                                    type="monotone"
                                    dataKey={selectedAggValue}
                                    stroke={getBlueTone(0, aggFieldValues.length)}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    activeDot={false}
                                    className="no-dot"
                                  />,
                                  <Line
                                    key={selectedAggValue + '_trend'}
                                    type="monotone"
                                    dataKey={`${selectedAggValue}_trend`}
                                    stroke={getBlueTone(1, aggFieldValues.length)}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    strokeDasharray="6 3"
                                    activeDot={false}
                                    className="no-dot"
                                  />
                                ]
                          ) : (
                            <>
                              <Line type="monotone" dataKey="actual" stroke={getBlueTone(0, aggFieldValues.length)} dot={false} activeDot={false} className="no-dot" />
                              <Line type="monotone" dataKey="trend" stroke={getBlueTone(1, aggFieldValues.length)} dot={false} activeDot={false} className="no-dot" />
                            </>
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={
                        selectedAggField === 'All portfolio'
                          ? allPortfolioTrend || []
                          : selectedAggField !== 'None'
                            ? groupAggregatedTrend || []
                            : (analysis?.trend?.trendLine || [])
                      }>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                          interval="preserveStartEnd"
                            angle={-30}
                            textAnchor="end"
                            height={60}
                            tickFormatter={(value) => {
                              try {
                                const date = new Date(value);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return value;
                              }
                            }}
                          />
                          <YAxis />
                          <Tooltip
                            formatter={(value, name) => {
                            if (name === 'trend' || name === 'volatility') {
                              return [Number(value).toFixed(1), name];
                              }
                              if (typeof value === 'number') {
                                return [value.toLocaleString(), name];
                              }
                              return [value, name];
                            }}
                          labelFormatter={label => {
                              try {
                                const date = new Date(label);
                              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return label;
                              }
                            }}
                        />
                        {selectedAggField === 'All portfolio' ? (
                          <>
                            <Line type="monotone" dataKey="sales" stroke={getBlueTone(0, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                            <Line type="monotone" dataKey="trend" stroke={getBlueTone(1, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                          </>
                        ) : selectedAggField !== 'None' ? (
                          selectedAggValue === 'All'
                            ? aggFieldValues.map((field, idx) => [
                                <Line
                                  key={field}
                                  type="monotone"
                                  dataKey={field}
                                  stroke={getBlueTone(idx, aggFieldValues.length)}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls={false}
                                  activeDot={false}
                                  className="no-dot"
                                />,
                                <Line
                                  key={field + '_trend'}
                                  type="monotone"
                                  dataKey={`${field}_trend`}
                                  stroke={getBlueTone(idx + 1, aggFieldValues.length)}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls={false}
                                  strokeDasharray="6 3"
                                  activeDot={false}
                                  className="no-dot"
                                />
                              ])
                            : [
                                <Line
                                  key={selectedAggValue}
                                  type="monotone"
                                  dataKey={selectedAggValue}
                                  stroke={getBlueTone(0, aggFieldValues.length)}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls={false}
                                  activeDot={false}
                                  className="no-dot"
                                />,
                                <Line
                                  key={selectedAggValue + '_trend'}
                                  type="monotone"
                                  dataKey={`${selectedAggValue}_trend`}
                                  stroke={getBlueTone(1, aggFieldValues.length)}
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls={false}
                                  strokeDasharray="6 3"
                                  activeDot={false}
                                  className="no-dot"
                          />
                              ]
                        ) : (
                          <>
                            <Line type="monotone" dataKey="actual" stroke={getBlueTone(0, aggFieldValues.length)} dot={false} activeDot={false} className="no-dot" />
                            <Line type="monotone" dataKey="trend" stroke={getBlueTone(1, aggFieldValues.length)} dot={false} activeDot={false} className="no-dot" />
                          </>
                        )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    </div>
              </CardContent>
            </Card>

            {/* Volatility Analysis */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Volatility Analysis
                </CardTitle>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="ml-auto">
                      <Maximize2 className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        Volatility Analysis
                      </DialogTitle>
                    </DialogHeader>
                    <div className="h-[60vh]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={volatilityChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            interval="preserveStartEnd"
                            angle={-30}
                            textAnchor="end"
                            height={60}
                            tickFormatter={(value) => {
                              try {
                                const date = new Date(value);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return value;
                              }
                            }}
                          />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip 
                            formatter={(value, name) => {
                              if (name === 'trend' || name === 'volatility') {
                                return [Number(value).toFixed(1), name];
                              }
                              if (typeof value === 'number') {
                                return [value.toLocaleString(), name];
                              }
                              return [value, name];
                            }}
                            labelFormatter={label => {
                              try {
                                const date = new Date(label);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return label;
                              }
                            }}
                          />
                          {/* Volatility lines (left axis) */}
                          {selectedAggField === 'All portfolio' ? (
                            <Line yAxisId="left" type="monotone" dataKey="volatility" stroke={getBlueTone(0, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                          ) : selectedAggField !== 'None' ? (
                            aggFieldValues.map((field, idx) => (
                              <Line
                                yAxisId="left"
                                key={field}
                                type="monotone"
                                dataKey={field}
                                stroke={getBlueTone(idx, aggFieldValues.length)}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                                activeDot={false}
                                className="no-dot"
                              />
                            ))
                          ) : (
                            <Line yAxisId="left" type="monotone" dataKey="volatility" stroke={getBlueTone(0, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                          )}
                          {/* Sales/aggregated sales line (right axis) */}
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey={selectedAggField === 'None' ? 'actual' : 'sales'}
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                            activeDot={false}
                            className="no-dot"
                            opacity={0.5}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={volatilityChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                          interval="preserveStartEnd"
                            angle={-30}
                            textAnchor="end"
                            height={60}
                            tickFormatter={(value) => {
                              try {
                                const date = new Date(value);
                                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return value;
                              }
                            }}
                          />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip
                            formatter={(value, name) => {
                            if (name === 'trend' || name === 'volatility') {
                              return [Number(value).toFixed(1), name];
                              }
                              if (typeof value === 'number') {
                                return [value.toLocaleString(), name];
                              }
                              return [value, name];
                            }}
                          labelFormatter={label => {
                              try {
                                const date = new Date(label);
                              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                              } catch {
                                return label;
                              }
                            }}
                        />
                        {selectedAggField === 'All portfolio' ? (
                          <Line yAxisId="left" type="monotone" dataKey="volatility" stroke={getBlueTone(0, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                        ) : selectedAggField !== 'None' ? (
                          aggFieldValues.map((field, idx) => (
                            <Line
                              yAxisId="left"
                              key={field}
                              type="monotone"
                              dataKey={field}
                              stroke={getBlueTone(idx, aggFieldValues.length)}
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                              activeDot={false}
                              className="no-dot"
                            />
                          ))
                        ) : (
                          <Line yAxisId="left" type="monotone" dataKey="volatility" stroke={getBlueTone(0, aggFieldValues.length)} strokeWidth={2} dot={false} connectNulls={false} activeDot={false} className="no-dot" />
                        )}
                        {/* Sales/aggregated sales line (right axis) */}
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey={selectedAggField === 'None' ? 'actual' : 'sales'}
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                          activeDot={false}
                          className="no-dot"
                          opacity={0.5}
                        />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    </div>
              </CardContent>
            </Card>

            {/* Data Quality */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                  Data Quality
                </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-sm text-slate-600">Completeness</div>
                        <div className="text-lg font-bold text-slate-800">
                        {dataQuality ? dataQuality.completeness.toFixed(1) + '%' : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-sm text-slate-600">Date Gaps</div>
                        <div className="text-lg font-bold text-slate-800">
                        {dataQuality ? dataQuality.dateGaps : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-sm text-slate-600">Zero Values</div>
                        <div className="text-lg font-bold text-slate-800">
                        {dataQuality ? dataQuality.zeroValues : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-sm text-slate-600">Missing Values</div>
                        <div className="text-lg font-bold text-slate-800">
                        {dataQuality ? dataQuality.missingValues : '—'}
                        </div>
                      </div>
                    </div>
                      </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};


