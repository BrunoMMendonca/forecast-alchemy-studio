import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import type { ForecastResult } from '@/types/forecast';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ForecastResultsProps {
  results: ForecastResult[];
  selectedSKU: string;
}

export const ForecastResults: React.FC<ForecastResultsProps> = ({
  results,
  selectedSKU,
}) => {
  if (results.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No forecast results available. Select a product and generate forecasts.
      </div>
    );
  }

  const chartData = {
    labels: results[0].predictions.map(p => p.date),
    datasets: results.map((result, index) => ({
      label: result.model,
      data: result.predictions.map(p => p.value),
      borderColor: getColorForIndex(index),
      backgroundColor: getColorForIndex(index, 0.1),
      fill: true,
      tension: 0.4,
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Forecast Results for ${selectedSKU}`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Sales',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="h-[400px]">
        <Line data={chartData} options={options} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((result, index) => (
          <div key={result.model} className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">{result.model}</h3>
            {result.accuracy && (
              <p className="text-sm text-gray-600">
                Accuracy: {(result.accuracy * 100).toFixed(1)}%
              </p>
            )}
            <div className="mt-2">
              <p className="text-sm font-medium">Latest Prediction:</p>
              <p className="text-lg font-bold">
                {result.predictions[result.predictions.length - 1].value.toFixed(0)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to generate colors for different models
const getColorForIndex = (index: number, alpha = 1) => {
  const colors = [
    `rgba(54, 162, 235, ${alpha})`,  // Blue
    `rgba(255, 99, 132, ${alpha})`,  // Red
    `rgba(75, 192, 192, ${alpha})`,  // Teal
  ];
  return colors[index % colors.length];
}; 