/**
 * ⚠️  PROTECTED COMPONENT - DO NOT MODIFY ⚠️
 * 
 * This is a core chart rendering component that contains:
 * - Chart.js plugin registration (critical for tooltips, legends, etc.)
 * - Core chart rendering logic
 * - Chart.js adapter registration
 * 
 * Changes here can break:
 * - Tooltip functionality
 * - Legend display
 * - Time scale rendering
 * - All Chart.js features
 * 
 * 🤖 AI AGENT INSTRUCTIONS:
 * =========================
 * This component is PROTECTED and should NOT be modified without explicit user permission.
 * 
 * BEFORE making any changes to this file:
 * 1. ALWAYS ask the user for explicit permission
 * 2. Explain why the change is necessary
 * 3. Describe the potential risks/impacts
 * 4. Suggest alternatives if possible
 * 
 * If you need to modify chart rendering, consider:
 * - Modifying the ChartContainer options instead
 * - Adding new props to ChartDisplay for configuration
 * - Creating a new chart type component
 * 
 * DO NOT proceed with changes until user explicitly approves.
 */

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';

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
  TimeScale
);

export interface ChartDisplayProps {
  data: any; // ChartData<'line'>
  options: any; // ChartOptions<'line'>
  chartRef?: React.RefObject<ChartJS<'line'>>;
  className?: string;
  height?: number | string;
}

export const ChartDisplay: React.FC<ChartDisplayProps> = ({
  data,
  options,
  chartRef,
  className,
  height = 600,
}) => {
  return (
    <div className={className} style={{ height }}>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}; 