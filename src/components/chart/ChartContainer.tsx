/**
 * ⚠️  PROTECTED COMPONENT - DO NOT MODIFY ⚠️
 * 
 * This is a stable, production-ready modular chart component.
 * All advanced features are implemented and tested:
 * - Tooltips with custom formatting (🔵/🔴 indicators)
 * - Advanced pan/zoom with autozoom
 * - Wheel event handling based on autozoom state
 * - Performance optimizations
 * - Seamless historical/forecast data integration
 * 
 * Changes should only be made after thorough testing and validation.
 * Consider creating a new component if major modifications are needed.
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
 * If you need to modify chart behavior, consider:
 * - Creating a new component that extends this one
 * - Modifying the parent component that uses this chart
 * - Adding props to make the behavior configurable
 * 
 * DO NOT proceed with changes until user explicitly approves.
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Chart as ChartJS, ChartOptions, ChartData } from 'chart.js';
import { ChartDisplay } from './ChartDisplay';
import { ChartControls } from './ChartControls';
import { useChartPerformanceStore } from '@/store/chartPerformanceStore';

export interface ChartContainerProps {
  historicalData: Array<{ date: string; value: number }>;
  forecastData?: Array<{ date: string; forecast: number; lowerBound?: number; upperBound?: number }>;
  modelName?: string;
  className?: string;
}

// Debounce utility
function useDebounce(callback: Function, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
}

const calculationCache = new Map<string, any>();
const CACHE_TTL = 30000;
const getCachedResult = (key: string, calculation: () => any) => {
  const cached = calculationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  const result = calculation();
  calculationCache.set(key, { value: result, timestamp: Date.now() });
  return result;
};

export const ChartContainer: React.FC<ChartContainerProps> = ({
  historicalData,
  forecastData,
  modelName = 'Chart',
  className,
}) => {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [autoZoom, setAutoZoom] = useState(true);
  const [autoZoomToggleCount, setAutoZoomToggleCount] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<any>(null);
  const [panLimits, setPanLimits] = useState<any>(null);
  const { getPrecomputedData, setPrecomputedData, renderSettings } = useChartPerformanceStore();

  // Data processing (seamless, forecast optional)
  const chartData = useMemo(() => {
    const dataKey = `${historicalData.length}_${forecastData?.length ?? 0}_${JSON.stringify(historicalData[0]?.date)}_${JSON.stringify(forecastData?.[0]?.date)}`;
    const cached = getPrecomputedData(dataKey);
    if (cached) return cached;
    const combined = [
      ...historicalData.map(item => ({
        date: item.date,
        historical: item.value,
        forecast: null,
        type: 'historical' as const
      })),
      ...(forecastData?.map(item => ({
        date: item.date,
        historical: null,
        forecast: item.forecast,
        type: 'forecast' as const
      })) ?? [])
    ];
    const sortedData = combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setPrecomputedData(dataKey, sortedData);
    return sortedData;
  }, [historicalData, forecastData, getPrecomputedData, setPrecomputedData]);

  const seamlessChartData = useMemo(() => {
    const dataKey = `seamless_${historicalData.length}_${forecastData?.length ?? 0}_${JSON.stringify(historicalData[0]?.date)}_${JSON.stringify(forecastData?.[0]?.date)}`;
    const cached = getPrecomputedData(dataKey);
    if (cached) return cached;
    const seamlessData = chartData.map(item => ({
      date: item.date,
      value: item.historical !== null ? item.historical : item.forecast,
      type: item.type
    }));
    setPrecomputedData(dataKey, seamlessData);
    return seamlessData;
  }, [chartData, getPrecomputedData, setPrecomputedData]);

  const separationIndex = useMemo(() => {
    return chartData.findIndex(item => item.type === 'forecast');
  }, [chartData]);

  // Pan/zoom/autozoom logic
  const basePanLimits = useMemo(() => {
    const allDates = seamlessChartData.map(item => new Date(item.date).getTime());
    const earliestDate = Math.min(...allDates);
    const latestDate = Math.max(...allDates);
    const dateRange = latestDate - earliestDate;
    const buffer = dateRange;
    const allValues = seamlessChartData.map(item => item.value).filter(val => val !== null && val !== undefined);
    const yMin = Math.min(...allValues);
    const yMax = Math.max(...allValues);
    const yRange = yMax - yMin;
    const yBuffer = yRange;
    return { earliestDate, latestDate, dateRange, buffer, yMin, yMax, yRange, yBuffer };
  }, [seamlessChartData]);

  function getPanLimits() {
    let currentXRange = basePanLimits.dateRange;
    let currentYRange = basePanLimits.yRange;
    if (chartRef.current && chartRef.current.scales.x && chartRef.current.scales.y) {
      const xScale = chartRef.current.scales.x;
      const yScale = chartRef.current.scales.y;
      if (typeof xScale.min === 'number' && typeof xScale.max === 'number') {
        currentXRange = xScale.max - xScale.min;
      }
      if (typeof yScale.min === 'number' && typeof yScale.max === 'number') {
        currentYRange = yScale.max - yScale.min;
      }
    }
    const currentXMin = chartRef.current?.scales.x?.min as number || basePanLimits.earliestDate;
    const currentXMax = chartRef.current?.scales.x?.max as number || basePanLimits.latestDate;
    const currentVisibleRange = currentXMax - currentXMin;
    const zoomFactor = currentVisibleRange / basePanLimits.dateRange;
    const dynamicBuffer = basePanLimits.buffer * zoomFactor;
    const panMin = basePanLimits.earliestDate - dynamicBuffer;
    const panMax = basePanLimits.latestDate + dynamicBuffer;
    const currentYMin = chartRef.current?.scales.y?.min as number || basePanLimits.yMin;
    const currentYMax = chartRef.current?.scales.y?.max as number || basePanLimits.yMax;
    const currentYVisibleRange = currentYMax - currentYMin;
    const yZoomFactor = currentYVisibleRange / basePanLimits.yRange;
    const dynamicYBuffer = basePanLimits.yBuffer * yZoomFactor;
    const yPanMin = Math.max(0, basePanLimits.yMin - dynamicYBuffer);
    const yPanMax = basePanLimits.yMax + dynamicYBuffer;
    return {
      panMin, panMax, earliestDate: basePanLimits.earliestDate, latestDate: basePanLimits.latestDate, dateRange: basePanLimits.dateRange, buffer: basePanLimits.buffer, yPanMin, yPanMax, yMin: basePanLimits.yMin, yMax: basePanLimits.yMax, yRange: basePanLimits.yRange, yBuffer: basePanLimits.yBuffer
    };
  }

  // Debounced autozoom
  const getVisibleYRange = useCallback(() => {
    if (!chartRef.current) return { highest: null, lowest: null };
    const chart = chartRef.current;
    const scales = chart.scales;
    if (!scales.x || !scales.y) return { highest: null, lowest: null };
    const xMin = scales.x.min;
    const xMax = scales.x.max;
    if (typeof xMin !== 'number' || typeof xMax !== 'number') {
      return { highest: null, lowest: null };
    }
    const cacheKey = `visibleRange_${Math.round(xMin)}_${Math.round(xMax)}_${seamlessChartData.length}`;
    const cached = calculationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 1000) {
      return cached.value;
    }
    let startIndex = 0;
    let endIndex = seamlessChartData.length - 1;
    while (startIndex < endIndex) {
      const mid = Math.floor((startIndex + endIndex) / 2);
      const midTimestamp = new Date(seamlessChartData[mid].date).getTime();
      if (midTimestamp < xMin) {
        startIndex = mid + 1;
      } else {
        endIndex = mid;
      }
    }
    endIndex = seamlessChartData.length - 1;
    let tempStart = startIndex;
    while (tempStart < endIndex) {
      const mid = Math.floor((tempStart + endIndex + 1) / 2);
      const midTimestamp = new Date(seamlessChartData[mid].date).getTime();
      if (midTimestamp > xMax) {
        endIndex = mid - 1;
      } else {
        tempStart = mid;
      }
    }
    const visibleData = seamlessChartData.slice(startIndex, endIndex + 1);
    if (visibleData.length === 0) {
      const result = { highest: null, lowest: null };
      calculationCache.set(cacheKey, { value: result, timestamp: Date.now() });
      return result;
    }
    let highest = -Infinity;
    let lowest = Infinity;
    for (const item of visibleData) {
      if (item.value !== null && item.value !== undefined) {
        highest = Math.max(highest, item.value);
        lowest = Math.min(lowest, item.value);
      }
    }
    const result = {
      highest: highest === -Infinity ? null : highest,
      lowest: lowest === Infinity ? null : lowest
    };
    calculationCache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  }, [seamlessChartData]);

  const debouncedAutozoom = useDebounce(() => {
    const chart = chartRef.current;
    if (!chart || !autoZoom) return;
    const { highest, lowest } = getVisibleYRange();
    if (highest !== null && lowest !== null) {
      const margin = Math.max((highest - lowest) * 0.1, 1);
      const newYMin = Math.max(0, Math.floor(lowest - margin));
      const newYMax = Math.ceil(highest + margin);
      const currentYMin = chart.options.scales.y.min;
      const currentYMax = chart.options.scales.y.max;
      const threshold = margin * 0.1;
      if (
        typeof currentYMin === 'number' &&
        typeof currentYMax === 'number' &&
        (Math.abs(currentYMin - newYMin) > threshold ||
          Math.abs(currentYMax - newYMax) > threshold)
      ) {
        chart.options.scales.y.min = newYMin;
        chart.options.scales.y.max = newYMax;
        chart.update('none');
      }
    }
  }, 16);

  // Chart.js data and options (forecast optional)
  const data: ChartData<'line'> = useMemo(() => {
    const validSeamlessData = seamlessChartData.filter(item => {
      const timestamp = new Date(item.date).getTime();
      return !isNaN(timestamp) && item.value !== null && item.value !== undefined;
    });
    const maxPoints = renderSettings.maxDataPoints;
    const step = validSeamlessData.length > maxPoints ? Math.ceil(validSeamlessData.length / maxPoints) : 1;
    const sampledData = validSeamlessData.filter((_, index) => index % step === 0);
    const labels = sampledData.map(item => new Date(item.date).getTime());
    return {
      labels,
      datasets: [
        {
          label: 'Historical Data',
          data: sampledData.map(item => ({ x: new Date(item.date).getTime(), y: item.value })),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.4,
          animation: sampledData.length > renderSettings.animationThreshold ? false : undefined,
          segment: {
            borderColor: (ctx) => {
              if (forecastData && ctx.p1DataIndex >= separationIndex) {
                return '#dc2626';
              }
              return '#2563eb';
            },
            borderDash: (ctx) => {
              if (forecastData && ctx.p1DataIndex >= separationIndex) {
                return [5, 5];
              }
              return [];
            }
          },
          pointBackgroundColor: (ctx) => {
            const index = ctx.dataIndex;
            return forecastData && index >= separationIndex ? '#dc2626' : '#2563eb';
          },
          pointBorderColor: (ctx) => {
            const index = ctx.dataIndex;
            return forecastData && index >= separationIndex ? '#dc2626' : '#2563eb';
          },
          pointHoverBackgroundColor: 'transparent',
          // pointHoverBackgroundColor: 'white',
          pointHoverBorderColor: (ctx) => {
            const index = ctx.dataIndex;
            return forecastData && index >= separationIndex ? '#dc2626' : '#2563eb';
          },
          pointHoverBorderWidth: 1,
        }
      ]
    };
  }, [seamlessChartData, separationIndex, renderSettings, forecastData]);

  const options: ChartOptions<'line'> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      // Performance optimization: Reduce interaction complexity
      interaction: {
        mode: 'nearest' as const, // TUNE: 'index' = vertical line, 'nearest' = closest point, 'dataset' = entire dataset
        intersect: true, // TUNE: Whether mouse must intersect with element
      },
      // Performance optimization: Disable animations for large datasets
      animation: seamlessChartData.length > 1000 ? false : {
        duration: 300 // TUNE: Animation duration in milliseconds
      },
      // Performance optimization: Reduce hover complexity
      hover: {
        mode: 'index' as const, // TUNE: Hover interaction mode
        intersect: false, // TUNE: Whether mouse must intersect with element
        animationDuration: 0 // TUNE: Hover animation duration (0 = instant)
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            generateLabels: (chart) => {
              const labels = [
                {
                  text: 'Historical Data',
                  fillStyle: '#2563eb',
                  strokeStyle: '#2563eb',
                  lineWidth: 2,
                  lineDash: [],
                  hidden: false,
                  index: 0
                }
              ];
              if (forecastData) {
                labels.push({
                  text: 'Forecast',
                  fillStyle: '#dc2626',
                  strokeStyle: '#dc2626',
                  lineWidth: 2,
                  lineDash: [5, 5],
                  hidden: false,
                  index: 1
                });
              }
              return labels;
            }
          }
        },

        tooltip: {
          enabled: true,
          displayColors: false,
          delay: 500,
          callbacks: {
            title: (context) => {
              const timestamp = context[0].parsed.x;
              const date = new Date(timestamp);
              return date.toLocaleDateString();
            },
            label: (context) => {
              const value = context.parsed.y;
              const dataIndex = context.dataIndex;
              const isForecast = forecastData && dataIndex >= separationIndex;
              const dot = isForecast ? '🔴' : '🔵';
              const label = isForecast ? 'Forecast' : 'Historical Data';
              return `${dot} ${label}: ${value?.toFixed(2) ?? 'N/A'}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          title: {
            display: true,
            text: 'Date',
          },
          time: {
            unit: 'month',
            displayFormats: {
              month: 'MMM yyyy'
            }
          },
          ticks: {
            source: 'auto'
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Value',
          },
          suggestedMin: 0,
          ticks: {
            callback: (value) => {
              const allValues = seamlessChartData.map(item => item.value).filter(val => val !== null && val !== undefined);
              const allIntegers = allValues.every(val => Number.isInteger(val));
              if (allIntegers) {
                return Math.round(Number(value)).toString();
              }
              return Number(value).toFixed(2);
            }
          }
        },
      },
    };
  }, [modelName, seamlessChartData, forecastData]);

  // Attach wheel event for pan/zoom
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const handleChartWheel = (event: WheelEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const area = chart.chartArea;
      const scales = chart.scales;
      
      // Define interaction zones
      const isMainArea = mouseX >= area.left && mouseX <= area.right && mouseY >= area.top && mouseY <= area.bottom;
      const isXAxis = mouseY > area.bottom && mouseY < area.bottom + 40;
      const isYAxis = mouseX < area.left && mouseX > area.left - 40;
      const isXLabel = mouseY > area.bottom + 40 && mouseY < area.bottom + 80;
      const isYLabel = mouseX < area.left - 40 && mouseX > area.left - 80;
      
      // When autozoom is ON: disable Y-axis wheel events
      if (autoZoom && (isYAxis || isYLabel)) {
        event.preventDefault();
        return;
      }
      
      // When autozoom is OFF: allow all wheel events
      // When autozoom is ON: only allow X-axis and main area wheel events
      if (autoZoom && !isMainArea && !isXAxis && !isXLabel) {
        event.preventDefault();
        return;
      }
      
      const { panMin, panMax, yPanMin, yPanMax } = getPanLimits();
      function setXRange(newMin: number, newMax: number) {
        const currentXMin = typeof chart.options.scales.x.min === 'number' ? chart.options.scales.x.min : 0;
        const currentXMax = typeof chart.options.scales.x.max === 'number' ? chart.options.scales.x.max : Date.now();
        const isZoomingOut = newMax - newMin > (currentXMax - currentXMin);
        let clampedMin = newMin;
        let clampedMax = newMax;
        if (!isZoomingOut) {
          clampedMin = Math.max(panMin, newMin);
          clampedMax = Math.min(panMax, newMax);
        }
        if (clampedMax > clampedMin) {
          chart.options.scales.x.min = clampedMin;
          chart.options.scales.x.max = clampedMax;
          chart.update();
        }
      }
      function setYRange(newMin: number, newMax: number) {
        const clampedMin = Math.max(yPanMin, newMin);
        const clampedMax = Math.min(yPanMax, newMax);
        if (clampedMax > clampedMin) {
          chart.options.scales.y.min = clampedMin;
          chart.options.scales.y.max = clampedMax;
          chart.update();
        }
      }
      // Helper to auto-fit Y
      function autoFitY() {
        const { highest, lowest } = getVisibleYRange();
        if (highest !== null && lowest !== null) {
          const margin = Math.max((highest - lowest) * 0.1, 1);
          const newYMin = Math.max(0, Math.floor(lowest - margin));
          const newYMax = Math.ceil(highest + margin);
          chart.options.scales.y.min = newYMin;
          chart.options.scales.y.max = newYMax;
          chart.update('none');
        }
      }
      if (isMainArea || isXAxis || isXLabel) {
        if (!event.ctrlKey && !event.metaKey) {
          const xMin = scales.x.min;
          const xMax = scales.x.max;
          const range = xMax - xMin;
          const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;
          const newRange = range * zoomFactor;
          const newMin = xMax - newRange;
          setXRange(newMin, xMax);
          if (autoZoom && (chart as any).applyAutozoom) {
            (chart as any).applyAutozoom();
          }
          event.preventDefault();
          return;
        } else {
          const xMin = scales.x.min;
          const xMax = scales.x.max;
          const range = xMax - xMin;
          const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;
          const mouseIndex = Math.round(scales.x.getValueForPixel(mouseX));
          const mouseFrac = (mouseIndex - xMin) / range;
          const newRange = range * zoomFactor;
          const newMin = mouseIndex - mouseFrac * newRange;
          const newMax = mouseIndex + (1 - mouseFrac) * newRange;
          setXRange(newMin, newMax);
          if (autoZoom && (chart as any).applyAutozoom) {
            (chart as any).applyAutozoom();
          }
          event.preventDefault();
          return;
        }
      }
      if (isYAxis || isYLabel) {
        const yMin = scales.y.min;
        const yMax = scales.y.max;
        const range = yMax - yMin;
        const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;
        const center = (yMin + yMax) / 2;
        const newRange = range * zoomFactor;
        const newMin = center - newRange / 2;
        const newMax = center + newRange / 2;
        setYRange(newMin, newMax);
        event.preventDefault();
        return;
      }
    };
    container.addEventListener('wheel', handleChartWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleChartWheel);
    };
  }, [autoZoom, getVisibleYRange]);

  // Mouse event handlers for manual panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const chart = chartRef.current;
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const area = chart.chartArea;
    const isMainArea = mouseX >= area.left && mouseX <= area.right && mouseY >= area.top && mouseY <= area.bottom;
    if (!isMainArea) return;
    const scales = chart.scales;
    const xMin = scales.x?.min as number;
    const xMax = scales.x?.max as number;
    const yMin = scales.y?.min as number;
    const yMax = scales.y?.max as number;
    const limits = getPanLimits();
    setPanLimits({ panMin: limits.panMin, panMax: limits.panMax, yPanMin: limits.yPanMin, yPanMax: limits.yPanMax });
    setIsPanning(true);
    setPanStart({ x: mouseX, y: mouseY, xMin, xMax, yMin, yMax });
    document.body.style.cursor = 'grabbing';
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    container.addEventListener('mousedown', handleMouseDown as any);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning && panStart && chartRef.current) {
        const chart = chartRef.current;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const deltaX = mouseX - panStart.x;
        const deltaY = mouseY - panStart.y;
        const area = chart.chartArea;
        const scales = chart.scales;
        const xRange = panStart.xMax - panStart.xMin;
        const yRange = panStart.yMax - panStart.yMin;
        const xPanDistance = (deltaX / area.width) * xRange;
        const yPanDistance = (deltaY / area.height) * yRange;
        if (!panLimits) return;
        const { panMin, panMax, yPanMin, yPanMax } = panLimits;
        let newXMin = panStart.xMin - xPanDistance;
        let newXMax = panStart.xMax - xPanDistance;
        let newYMin = panStart.yMin + yPanDistance;
        let newYMax = panStart.yMax + yPanDistance;
        let clamped = false;
        if (newXMin < panMin) {
          newXMin = panMin;
          newXMax = panMin + xRange;
          clamped = true;
        }
        if (newXMax > panMax) {
          newXMax = panMax;
          newXMin = panMax - xRange;
          clamped = true;
        }
        if (!autoZoom) {
          if (newYMin < yPanMin) {
            newYMin = yPanMin;
            newYMax = yPanMin + yRange;
            clamped = true;
          }
          if (newYMax > yPanMax) {
            newYMax = yPanMax;
            newYMin = yPanMax - yRange;
            clamped = true;
          }
        }
        chart.options.scales.x.min = newXMin;
        chart.options.scales.x.max = newXMax;
        if (!autoZoom) {
          chart.options.scales.y.min = newYMin;
          chart.options.scales.y.max = newYMax;
        }
        chart.update('none');
        if (autoZoom) {
          const { highest, lowest } = getVisibleYRange();
          if (highest !== null && lowest !== null) {
            const margin = Math.max((highest - lowest) * 0.1, 1);
            const newYMin = Math.max(0, Math.floor(lowest - margin));
            const newYMax = Math.ceil(highest + margin);
            const currentYMin = chart.options.scales.y.min;
            const currentYMax = chart.options.scales.y.max;
            const threshold = margin * 0.1;
            if (
              typeof currentYMin === 'number' &&
              typeof currentYMax === 'number' &&
              (Math.abs(currentYMin - newYMin) > threshold ||
                Math.abs(currentYMax - newYMax) > threshold)
            ) {
              chart.options.scales.y.min = newYMin;
              chart.options.scales.y.max = newYMax;
              chart.update('none');
            }
          }
        }
      }
    };
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        setPanLimits(null);
        document.body.style.cursor = 'default';
      }
    };
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown as any);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleMouseDown, isPanning, panStart, autoZoom, panLimits, getVisibleYRange]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (chartRef.current) {
      const chart = chartRef.current;
      const scales = chart.scales;
      const xMin = typeof scales.x?.min === 'number' ? scales.x.min : getPanLimits().earliestDate;
      const xMax = typeof scales.x?.max === 'number' ? scales.x.max : getPanLimits().latestDate;
      const xRange = xMax - xMin;
      const zoomFactor = 0.9;
      const newRange = xRange * zoomFactor;
      const center = (xMin + xMax) / 2;
      const newMin = center - newRange / 2;
      const newMax = center + newRange / 2;
      const { panMin, panMax } = getPanLimits();
      let clampedMin = Math.max(panMin, newMin);
      let clampedMax = Math.min(panMax, newMax);
      if (clampedMax > clampedMin) {
        chart.options.scales.x.min = clampedMin;
        chart.options.scales.x.max = clampedMax;
        chart.update('none');
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.update('none');
          }
        }, 10);
        if (autoZoom && (chart as any).applyAutozoom) {
          setTimeout(() => (chart as any).applyAutozoom(), 10);
        }
      }
    }
  }, [autoZoom]);

  const handleZoomOut = useCallback(() => {
    if (chartRef.current) {
      const chart = chartRef.current;
      const scales = chart.scales;
      const xMin = typeof scales.x?.min === 'number' ? scales.x.min : getPanLimits().earliestDate;
      const xMax = typeof scales.x?.max === 'number' ? scales.x.max : getPanLimits().latestDate;
      const xRange = xMax - xMin;
      const zoomFactor = 1.1;
      const newRange = xRange * zoomFactor;
      const center = (xMin + xMax) / 2;
      const newMin = center - newRange / 2;
      const newMax = center + newRange / 2;
      const { panMin, panMax } = getPanLimits();
      let clampedMin = Math.max(panMin, newMin);
      let clampedMax = Math.min(panMax, newMax);
      if (clampedMax > clampedMin) {
        chart.options.scales.x.min = clampedMin;
        chart.options.scales.x.max = clampedMax;
        chart.update('none');
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.update('none');
          }
        }, 10);
        if (autoZoom && (chart as any).applyAutozoom) {
          setTimeout(() => (chart as any).applyAutozoom(), 10);
        }
      }
    }
  }, [autoZoom]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      const chart = chartRef.current;
      chart.options.scales.x.min = getPanLimits().earliestDate;
      chart.options.scales.x.max = getPanLimits().latestDate;
      chart.update('none');
      setTimeout(() => {}, 50);
      if (autoZoom && (chart as any).applyAutozoom) {
        setTimeout(() => (chart as any).applyAutozoom(), 50);
      }
    }
  }, [autoZoom]);

  // Autozoom imperative
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !autoZoom) return;
    const applyAutozoom = () => {
      debouncedAutozoom();
    };
    (chart as any).applyAutozoom = applyAutozoom;
    return () => {
      delete (chart as any).applyAutozoom;
    };
  }, [autoZoom, getVisibleYRange]);

  return (
    <div className={className} ref={chartContainerRef}>
      <ChartControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        autoZoom={autoZoom}
        onToggleAutoZoom={() => {
          setAutoZoom(z => !z);
          setAutoZoomToggleCount(c => c + 1);
        }}
      />
      <ChartDisplay
        data={data}
        options={options}
        chartRef={chartRef}
        height={600}
      />
    </div>
  );
}; 