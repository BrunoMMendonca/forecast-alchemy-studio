import React, { useRef, useCallback, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { useTrendLinesStore } from '@/store/trendLinesStore';

// Register Chart.js plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
  annotationPlugin
);

interface ReusableForecastChartProps {
  historicalData: Array<{
    date: string;
    value: number;
  }>;
  forecastData: Array<{
    date: string;
    forecast: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  datasetId: number;
  sku: string;
  title?: string;
  height?: number;
  showTrendLines?: boolean;
  includeFutureTrendLines?: boolean;
  onTrendLineClick?: (trendLineId: string) => void;
}

export const ReusableForecastChart: React.FC<ReusableForecastChartProps> = ({
  historicalData,
  forecastData,
  datasetId,
  sku,
  title = 'Forecast Chart',
  height = 400,
  showTrendLines = true,
  includeFutureTrendLines = false,
  onTrendLineClick
}) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Trend lines store integration
  const { 
    getTrendLinesForChart,
    isLoading: trendLinesLoading 
  } = useTrendLinesStore();

  // Combine and sort data
  const chartData = React.useMemo(() => {
    const combined = [
      ...historicalData.map(item => ({
        date: item.date,
        historical: item.value,
        forecast: null,
        type: 'historical' as const
      })),
      ...forecastData.map(item => ({
        date: item.date,
        historical: null,
        forecast: item.forecast,
        type: 'forecast' as const
      }))
    ];

    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [historicalData, forecastData]);

  // Get trend lines for this chart with smart filtering
  const chartTrendLines = React.useMemo(() => {
    if (!showTrendLines) return [];
    return getTrendLinesForChart(datasetId, sku, chartData, includeFutureTrendLines);
  }, [getTrendLinesForChart, datasetId, sku, chartData, showTrendLines, includeFutureTrendLines]);

  // Find separation point for annotation
  const separationIndex = chartData.findIndex(item => item.type === 'forecast');

  // Chart.js data configuration
  const data: ChartData<'line'> = React.useMemo(() => ({
    labels: chartData.map(item => item.date),
    datasets: [
      {
        label: 'Historical Data',
        data: chartData.map(item => item.historical),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.4,
        segment: {
          borderColor: (ctx) => {
            if (ctx.p1DataIndex >= separationIndex) return 'transparent';
            return '#2563eb';
          }
        }
      },
      {
        label: 'Forecast',
        data: chartData.map(item => item.forecast),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.4,
        segment: {
          borderColor: (ctx) => {
            if (ctx.p1DataIndex < separationIndex) return 'transparent';
            return '#dc2626';
          }
        }
      }
    ]
  }), [chartData, separationIndex]);

  // Chart.js options
  const options: ChartOptions<'line'> = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: !!title,
        text: title,
      },
      tooltip: {
        enabled: true,
        delay: 1000,
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].label);
            return date.toLocaleDateString();
          },
          label: (context) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value?.toFixed(2) || 'N/A'}`;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          mode: 'x' as const,
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          drag: {
            enabled: false,
          },
        },
      },
      annotation: {
        annotations: {
          // Trend lines as annotations
          ...chartTrendLines.reduce((acc, line) => {
            const slope = (line.endValue - line.startValue) / (line.endIndex - line.startIndex);
            
            // Always extend infinitely - use the entire chart area
            return {
              ...acc,
              [`trendLine${line.id}`]: {
                type: 'line' as const,
                xMin: 0,
                yMin: line.startValue + slope * (0 - line.startIndex),
                xMax: chartData.length - 1,
                yMax: line.startValue + slope * ((chartData.length - 1) - line.startIndex),
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [2, 2],
                click: onTrendLineClick ? () => onTrendLineClick(line.id) : undefined,
              }
            };
          }, {})
        }
      }
    },
    scales: {
      x: {
        type: 'category' as const,
        title: {
          display: true,
          text: 'Date',
        },
        ticks: {
          callback: (value) => {
            const date = new Date(chartData[value as number]?.date);
            return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Value',
        },
      },
    },
  }), [title, chartData, chartTrendLines, onTrendLineClick]);

  return (
    <div className="relative" style={{ height }}>
      <Line 
        ref={chartRef}
        data={data} 
        options={options}
      />
      {trendLinesLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-sm text-gray-600">Loading trend lines...</div>
        </div>
      )}
    </div>
  );
}; 
