import React from 'react';
import { SalesData } from '@/types/sales';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataVisualizationProps {
  data: SalesData[];
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No data to display.</p>;
  }

  const renderCustomTooltip = (props: any) => {
    if (!props || !props.payload || props.payload.length === 0) {
      return null;
    }

    const payload = props.payload[0].payload;
    return (
      <div className="bg-white border border-gray-300 p-2 rounded-md shadow-md">
        <p className="font-semibold">{payload.date}</p>
        <p>Sales: {payload.sales}</p>
        {payload.isOutlier && <p className="text-red-500">Outlier</p>}
        {payload.note && <p>Note: {payload.note}</p>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip content={renderCustomTooltip} />
        <Line type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" />
      </LineChart>
    </ResponsiveContainer>
  );
};
