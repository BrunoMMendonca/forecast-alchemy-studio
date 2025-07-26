export interface DateFrequency {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  seasonalPeriod: number;
}

export const generateDates = (startDate: Date, periods: number): string[] => {
  const dates: string[] = [];
  const currentDate = new Date(startDate);
  
  for (let i = 0; i < periods; i++) {
    currentDate.setMonth(currentDate.getMonth() + 1);
    dates.push(currentDate.toISOString().split('T')[0]);
  }
  
  return dates;
};

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

/**
 * Parses a date string according to the given format.
 * Supported formats: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy, yyyy/mm/dd
 * Also supports weekly formats: yyyy-ww, ww-yyyy, yyyy/ww, ww/yyyy, yyyy-wwrange, weekrange
 */
export function parseDateWithFormat(dateStr: string, format: string): Date | null {
  if (!dateStr) return null;
  
  // Handle weekly formats
  if (format.startsWith('yyyy-ww') || format.startsWith('ww-yyyy') || 
      format.startsWith('yyyy/ww') || format.startsWith('ww/yyyy') ||
      format === 'yyyy-wwrange' || format === 'weekrange') {
    return parseWeeklyFormat(dateStr, format);
  }
  
  // Handle yearly format
  if (format === 'yyyy') {
    const year = parseInt(dateStr, 10);
    if (isNaN(year) || year < 1900 || year > 2100) return null;
    return new Date(year, 0, 1); // January 1st of the year
  }
  
  // Handle daily formats
  let day: number, month: number, year: number;
  let parts: string[];
  switch (format) {
    case 'dd/mm/yyyy':
      parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      break;
    case 'mm/dd/yyyy':
      parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      break;
    case 'yyyy-mm-dd':
      parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      break;
    case 'dd-mm-yyyy':
      parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      break;
    case 'yyyy/mm/dd':
      parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      break;
    default:
      return null;
  }
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

/**
 * Parses weekly date formats and returns the start of the week.
 * For week ranges, returns the start of the first week.
 */
function parseWeeklyFormat(dateStr: string, format: string): Date | null {
  if (!dateStr) return null;
  
  let year: number, week: number;
  
  switch (format) {
    case 'yyyy-ww':
      // Format: 2023-W05
      const yyyyWwMatch = dateStr.match(/^(\d{4})-W(\d{2})$/);
      if (!yyyyWwMatch) return null;
      year = parseInt(yyyyWwMatch[1], 10);
      week = parseInt(yyyyWwMatch[2], 10);
      break;
      
    case 'ww-yyyy':
      // Format: W05-2023
      const wwYyyyMatch = dateStr.match(/^W(\d{2})-(\d{4})$/);
      if (!wwYyyyMatch) return null;
      week = parseInt(wwYyyyMatch[1], 10);
      year = parseInt(wwYyyyMatch[2], 10);
      break;
      
    case 'yyyy/ww':
      // Format: 2023/W05
      const yyyyWwSlashMatch = dateStr.match(/^(\d{4})\/W(\d{2})$/);
      if (!yyyyWwSlashMatch) return null;
      year = parseInt(yyyyWwSlashMatch[1], 10);
      week = parseInt(yyyyWwSlashMatch[2], 10);
      break;
      
    case 'ww/yyyy':
      // Format: W05/2023
      const wwYyyySlashMatch = dateStr.match(/^W(\d{2})\/(\d{4})$/);
      if (!wwYyyySlashMatch) return null;
      week = parseInt(wwYyyySlashMatch[1], 10);
      year = parseInt(wwYyyySlashMatch[2], 10);
      break;
      
    case 'yyyy-wwrange':
      // Format: 2023-W01-W05 - return start of first week
      const yyyyWwRangeMatch = dateStr.match(/^(\d{4})-W(\d{2})-/);
      if (!yyyyWwRangeMatch) return null;
      year = parseInt(yyyyWwRangeMatch[1], 10);
      week = parseInt(yyyyWwRangeMatch[2], 10);
      break;
      
    case 'weekrange':
      // Format: W01-W05 - assume current year, return start of first week
      const weekRangeMatch = dateStr.match(/^W(\d{2})-/);
      if (!weekRangeMatch) return null;
      year = new Date().getFullYear();
      week = parseInt(weekRangeMatch[1], 10);
      break;
      
    default:
      return null;
  }
  
  if (isNaN(year) || isNaN(week) || week < 1 || week > 53) return null;
  
  // Convert ISO week to date (week starts on Monday)
  return getDateOfISOWeek(year, week);
}

/**
 * Returns the date of the Monday of the given ISO week.
 * ISO weeks start on Monday and the first week of the year is the one containing January 4th.
 */
function getDateOfISOWeek(year: number, week: number): Date {
  // January 4th is always in the first week of the year
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate the Monday of the first week
  const firstMonday = new Date(year, 0, 4 - (jan4Day === 0 ? 7 : jan4Day) + 1);
  
  // Add weeks to get to the target week
  const targetDate = new Date(firstMonday);
  targetDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  return targetDate;
}

/**
 * Attempts to auto-detect the most likely date format from an array of strings.
 * Supports daily, monthly, yearly, and weekly (ISO week, year-week, week-year, week ranges) formats.
 * Returns the best guess and a ranked list of candidates with match counts.
 */
export function autoDetectDateFormat(samples: string[]): {
  bestGuess: string | null,
  candidates: { format: string, count: number }[]
} {
  // Supported formats and their regexes
  const formats = [
    { format: 'yyyy-mm-dd', regex: /^\d{4}-\d{2}-\d{2}$/ },
    { format: 'dd/mm/yyyy', regex: /^\d{2}\/\d{2}\/\d{4}$/ },
    { format: 'mm/dd/yyyy', regex: /^\d{2}\/\d{2}\/\d{4}$/ },
    { format: 'dd-mm-yyyy', regex: /^\d{2}-\d{2}-\d{4}$/ },
    { format: 'yyyy/mm/dd', regex: /^\d{4}\/\d{2}\/\d{2}$/ },
    { format: 'yyyy', regex: /^\d{4}$/ },
    // Weekly formats
    { format: 'yyyy-ww', regex: /^\d{4}-W\d{2}$/ }, // ISO week (e.g. 2023-W05)
    { format: 'ww-yyyy', regex: /^W\d{2}-\d{4}$/ }, // e.g. W05-2023
    { format: 'yyyy/ww', regex: /^\d{4}\/W\d{2}$/ },
    { format: 'ww/yyyy', regex: /^W\d{2}\/\d{4}$/ },
    { format: 'yyyy-wwrange', regex: /^\d{4}-W\d{2}-W\d{2}$/ }, // e.g. 2023-W01-W05
    { format: 'weekrange', regex: /^W\d{2}-W\d{2}$/ }, // e.g. W01-W05
  ];

  const counts = formats.map(({ format, regex }) => ({
    format,
    count: samples.filter(s => regex.test(s)).length
  }));

  // Sort by count descending
  const sorted = counts.sort((a, b) => b.count - a.count);
  const bestGuess = sorted[0]?.count > 0 ? sorted[0].format : null;

  return {
    bestGuess,
    candidates: sorted.filter(c => c.count > 0)
  };
}
