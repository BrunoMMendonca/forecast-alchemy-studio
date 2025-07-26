interface SeasonalityResult {
  strength: number;
  primarySeason: string;
  monthlyPattern: Array<{ month: string; value: number }>;
}

interface TrendResult {
  direction: 'increasing' | 'decreasing' | 'stable';
  growthRate: number;
  trendLine: Array<{ date: string; actual: number; trend: number }>;
}

interface VolatilityResult {
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  volatilityLine: Array<{ date: string; volatility: number }>;
}

interface CorrelationResult {
  sku: string;
  correlation: number;
}

/**
 * Detects seasonality in sales data
 */
export function detectSeasonality(sales: number[]): SeasonalityResult {
  // Group sales by month
  const monthlySales = new Array(12).fill(0);
  const monthlyCount = new Array(12).fill(0);
  
  // Calculate average sales for each month
  sales.forEach((sale, index) => {
    const month = index % 12;
    monthlySales[month] += sale;
    monthlyCount[month]++;
  });

  const monthlyAverages = monthlySales.map((sum, i) => 
    monthlyCount[i] > 0 ? sum / monthlyCount[i] : 0
  );

  // Calculate seasonality strength
  const overallMean = monthlyAverages.reduce((a, b) => a + b, 0) / 12;
  const variance = monthlyAverages.reduce((sum, avg) => 
    sum + Math.pow(avg - overallMean, 2), 0) / 12;
  const strength = Math.sqrt(variance) / overallMean;

  // Find primary season
  const maxMonth = monthlyAverages.indexOf(Math.max(...monthlyAverages));
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  const primarySeason = months[maxMonth];

  // Always return all 12 months, even if value is 0
  const monthlyPattern = months.map((month, i) => ({
    month,
    value: monthlyAverages[i] || 0
  }));

  return {
    strength,
    primarySeason,
    monthlyPattern
  };
}

/**
 * Analyzes trend in sales data
 */
export function analyzeTrend(sales: number[], dates: Date[]): TrendResult {
  // Calculate simple moving average
  const windowSize = Math.min(6, Math.floor(sales.length / 4));
  const trendLine = sales.map((sale, i) => {
    const dateObj = dates[i];
    const dateStr = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toISOString() : '';
    const start = Math.max(0, i - windowSize + 1);
    const window = sales.slice(start, i + 1);
    const trend = window.reduce((a, b) => a + b, 0) / window.length;
    return {
      date: dateStr,
      actual: sale,
      trend
    };
  });

  // Calculate growth rate
  const firstValue = trendLine[0].trend;
  const lastValue = trendLine[trendLine.length - 1].trend;
  const growthRate = ((lastValue - firstValue) / firstValue) * 100;

  // Determine trend direction
  let direction: 'increasing' | 'decreasing' | 'stable';
  if (growthRate > 5) {
    direction = 'increasing';
  } else if (growthRate < -5) {
    direction = 'decreasing';
  } else {
    direction = 'stable';
  }

  return {
    direction,
    growthRate,
    trendLine
  };
}

/**
 * Calculates volatility in sales data
 */
export function calculateVolatility(sales: number[], dates?: Date[]): VolatilityResult {
  // Calculate daily returns
  const returns = sales.slice(1).map((sale, i) => 
    (sale - sales[i]) / sales[i]
  );

  // Calculate rolling volatility (standard deviation of returns)
  const windowSize = Math.min(30, Math.floor(returns.length / 4));
  const volatilityLine = returns.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = returns.slice(start, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((sum, ret) => 
      sum + Math.pow(ret - mean, 2), 0) / window.length;
    const dateObj = dates && dates[i + 1];
    const dateStr = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toISOString() : '';
    return {
      date: dateStr,
      volatility: Math.sqrt(variance)
    };
  });

  // Calculate average volatility
  const average = volatilityLine.reduce((sum, v) => sum + v.volatility, 0) / 
                 volatilityLine.length;

  // Determine volatility trend
  const firstHalf = volatilityLine.slice(0, Math.floor(volatilityLine.length / 2));
  const secondHalf = volatilityLine.slice(Math.floor(volatilityLine.length / 2));
  const firstAvg = firstHalf.reduce((sum, v) => sum + v.volatility, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v.volatility, 0) / secondHalf.length;
  
  let trend: 'increasing' | 'decreasing' | 'stable';
  if (secondAvg > firstAvg * 1.1) {
    trend = 'increasing';
  } else if (secondAvg < firstAvg * 0.9) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  return {
    average,
    trend,
    volatilityLine
  };
}

/**
 * Finds correlations between SKUs
 */
export function findCorrelations(data: any[], selectedSKU: string, columnMapping?: Record<string, string>): CorrelationResult[] {
  // Use column mapping if available, otherwise fallback to hardcoded names
  const skuColumn = columnMapping?.['Material Code'] || 'Material Code';
  const dateColumn = columnMapping?.['Date'] || 'Date';
  const salesColumn = columnMapping?.['Sales'] || 'Sales';
  
  const skus = Array.from(new Set(data.map(d => d[skuColumn])));
  const correlations: CorrelationResult[] = [];

  // Get sales data for selected SKU
  const selectedSales = data
    .filter(d => d[skuColumn] === selectedSKU)
    .sort((a, b) => new Date(a[dateColumn]).getTime() - new Date(b[dateColumn]).getTime())
    .map(d => d[salesColumn]);

  // Calculate correlation with other SKUs
  skus.forEach(sku => {
    if (sku === selectedSKU) return;

    const otherSales = data
      .filter(d => d[skuColumn] === sku)
      .sort((a, b) => new Date(a[dateColumn]).getTime() - new Date(b[dateColumn]).getTime())
      .map(d => d[salesColumn]);

    // Ensure both arrays have the same length
    const minLength = Math.min(selectedSales.length, otherSales.length);
    const selected = selectedSales.slice(0, minLength);
    const other = otherSales.slice(0, minLength);

    // Calculate correlation coefficient
    const mean1 = selected.reduce((a, b) => a + b, 0) / minLength;
    const mean2 = other.reduce((a, b) => a + b, 0) / minLength;
    
    const numerator = selected.reduce((sum, val, i) => 
      sum + (val - mean1) * (other[i] - mean2), 0);
    
    const denominator1 = Math.sqrt(selected.reduce((sum, val) => 
      sum + Math.pow(val - mean1, 2), 0));
    const denominator2 = Math.sqrt(other.reduce((sum, val) => 
      sum + Math.pow(val - mean2, 2), 0));

    const correlation = numerator / (denominator1 * denominator2);

    correlations.push({
      sku,
      correlation
    });
  });

  // Sort by absolute correlation value
  return correlations.sort((a, b) => 
    Math.abs(b.correlation) - Math.abs(a.correlation)
  );
}

/**
 * Finds gaps in date sequence
 */
export function findDateGaps(dates: Date[]): number {
  let gaps = 0;
  for (let i = 1; i < dates.length; i++) {
    const diff = dates[i].getTime() - dates[i-1].getTime();
    const expectedDiff = 24 * 60 * 60 * 1000; // One day in milliseconds
    if (diff > expectedDiff) {
      gaps++;
    }
  }
  return gaps;
}

// Export utility functions for completeness, date gaps, zero values, and missing values
export function calculateCompleteness(values: (number | undefined | null)[]) {
  const total = values.length;
  const missing = values.filter(v => v === null || v === undefined).length;
  return total > 0 ? ((total - missing) / total) * 100 : 0;
}

export function countZeroValues(values: (number | undefined | null)[]) {
  return values.filter(v => v === 0).length;
}

export function countMissingValues(values: (number | undefined | null)[]) {
  return values.filter(v => v === null || v === undefined).length;
}

// Utility function to calculate date gaps
export function countDateGaps(dates: Date[]): number {
  if (dates.length <= 1) return 0;
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let gaps = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    const oneDay = 24 * 60 * 60 * 1000; // Assuming daily data
    // const oneWeek = 7 * oneDay; // For weekly data
    const oneMonth = 30 * oneDay; // For monthly data (approximate)
    if (diff > oneDay) {
      gaps++;
    }
  }
  return gaps;
} 