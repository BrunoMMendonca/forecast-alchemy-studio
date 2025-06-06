
export interface DateFrequency {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  seasonalPeriod: number;
}

export const detectDateFrequency = (dates: string[]): DateFrequency => {
  if (dates.length < 2) {
    return { type: 'monthly', interval: 1, seasonalPeriod: 12 };
  }

  const sortedDates = dates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];
  
  for (let i = 1; i < Math.min(sortedDates.length, 10); i++) {
    const diffMs = sortedDates[i].getTime() - sortedDates[i-1].getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    intervals.push(diffDays);
  }

  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

  if (avgInterval <= 2) {
    return { type: 'daily', interval: 1, seasonalPeriod: 7 };
  } else if (avgInterval <= 8) {
    return { type: 'weekly', interval: 7, seasonalPeriod: 52 };
  } else if (avgInterval <= 35) {
    return { type: 'monthly', interval: 30, seasonalPeriod: 12 };
  } else if (avgInterval <= 100) {
    return { type: 'quarterly', interval: 90, seasonalPeriod: 4 };
  } else {
    return { type: 'yearly', interval: 365, seasonalPeriod: 1 };
  }
};

export const generateForecastDates = (
  lastDate: Date, 
  periods: number, 
  frequency: DateFrequency
): string[] => {
  const dates: string[] = [];
  
  for (let i = 1; i <= periods; i++) {
    const futureDate = new Date(lastDate);
    
    switch (frequency.type) {
      case 'daily':
        futureDate.setDate(lastDate.getDate() + i);
        break;
      case 'weekly':
        futureDate.setDate(lastDate.getDate() + (i * 7));
        break;
      case 'monthly':
        futureDate.setMonth(lastDate.getMonth() + i);
        break;
      case 'quarterly':
        futureDate.setMonth(lastDate.getMonth() + (i * 3));
        break;
      case 'yearly':
        futureDate.setFullYear(lastDate.getFullYear() + i);
        break;
    }
    
    dates.push(futureDate.toISOString().split('T')[0]);
  }
  
  return dates;
};
