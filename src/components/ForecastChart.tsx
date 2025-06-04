import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesData, ForecastResult } from '@/types/sales';

interface ForecastChartProps {
  historicalData: SalesData[];
  forecastResults: ForecastResult[];
  selectedSKU: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  historicalData,
  forecastResults,
  selectedSKU
}) => {
  const filteredHistoricalData = historicalData.filter(item => item.sku === selectedSKU);
  const filteredForecastResults = forecastResults.filter(item => item.sku === selectedSKU);

  const data = [...filteredHistoricalData, ...filteredForecastResults].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const dataItem = payload[0].payload;
      const isForecast = (dataItem as ForecastResult).model !== undefined;
      const salesValue = payload[0].value;

      return (
        <Card className="bg-white border rounded-md shadow-md">
          <CardContent className="p-2">
            <p className="text-sm font-semibold">{formatXAxis(label)}</p>
            <p className="text-xs">
              Sales: {salesValue}
            </p>
            {isForecast && (
              <p className="text-xs text-gray-500">
                Model: {(dataItem as ForecastResult).model}
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Chart for {selectedSKU}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatXAxis} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="sales" stroke="#8884d8" name="Historical Sales" />
            {filteredForecastResults.map((result) => (
              <Line
                key={result.model}
                type="monotone"
                dataKey="sales"
                stroke={result.color}
                name={`${result.model} Forecast`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
