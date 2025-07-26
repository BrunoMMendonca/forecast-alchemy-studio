import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Calendar, Clock, Building2, Settings, Loader2, Plus, X, CalendarDays, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Calendar as CalendarComponent } from '../../ui/calendar';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { useSetupWizardStoreRefactored } from '../../../store/setupWizardStoreRefactored';
import { toast } from 'sonner';

interface SopCyclesStepProps {
  pendingDivisions: any[];
  divisions: any[];
  sopCycles: any[];
  isLoadingSopCycles: boolean;
  newSopCycle: any;
  safeCreateSopCycle: () => void;
  safeSetNewSopCycle: (updates: any) => void;
}

interface SopCycleConfig {
  id?: number;
  companyId: number;
  divisionId?: number; // null for company-wide
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDay: number; // 1-31 for monthly, 1-7 for weekly (Monday=1)
  startMonth?: number; // 1-12 for quarterly/yearly
  cutOffDays: number; // Days before cycle end when regular users can't modify
  isActive: boolean;
  description?: string;
  
  // Working days configuration for different parameters
  workingDaysSettings: {
    startDate: {
      useWorkingDays: boolean; // Whether to use working days for start date
    };
    cutOffPeriod: {
      useWorkingDays: boolean; // Whether to use working days for cut-off period
    };
  };
  
  workingDaysConfig?: { // Configuration for working days
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    holidays?: string[]; // Array of holiday dates (YYYY-MM-DD) - keeping backward compatibility
    holidayObjects?: Array<{ // Array of holiday objects with names and dates
      name: string;
      startDate: string;
      endDate: string;
      isRange: boolean;
    }>;
  };
}

interface HolidayRange {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isRange: boolean;
}

export const SopCyclesStep: React.FC<SopCyclesStepProps> = ({
  pendingDivisions,
  divisions,
  sopCycles,
  isLoadingSopCycles,
  newSopCycle,
  safeCreateSopCycle,
  safeSetNewSopCycle
}) => {
  // Connect to Zustand store
  const {
    sopCycleConfigs,
    isLoadingSopCycleConfigs,
    createSopCycleConfig,
    updateSopCycleConfig,
    loadSopCycleConfigs,
    sopCycleConfig,
    setSopCycleConfig
  } = useSetupWizardStoreRefactored();

  // Default configuration
  const defaultConfig: SopCycleConfig = {
    companyId: 1, // Will be set from context
    frequency: 'monthly',
    startDay: 1,
    cutOffDays: 3,
    isActive: true,
    workingDaysSettings: {
      startDate: {
        useWorkingDays: false // Default to calendar days for start date
      },
      cutOffPeriod: {
        useWorkingDays: false // Default to calendar days for cut-off period
      }
    },
    workingDaysConfig: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      holidays: []
    }
  };

  const [sopConfigs, setSopConfigs] = useState<SopCycleConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SopCycleConfig | null>(
    sopCycleConfig ? {
      ...sopCycleConfig,
      companyId: 1,
      isActive: true
    } : defaultConfig
  );
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [previewCycles, setPreviewCycles] = useState<any[]>([]);
  
  // Holiday management state
  const [holidayRanges, setHolidayRanges] = useState<HolidayRange[]>([]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayStartDate, setNewHolidayStartDate] = useState<Date | undefined>(undefined);
  const [newHolidayEndDate, setNewHolidayEndDate] = useState<Date | undefined>(undefined);
  const [isHolidayRange, setIsHolidayRange] = useState(false);
  const [showHolidayPicker, setShowHolidayPicker] = useState(false);
  const [selectedHolidayYear, setSelectedHolidayYear] = useState(new Date().getFullYear());
  const [showWorkingDaysConfig, setShowWorkingDaysConfig] = useState(false);
  const [enableCutOffPeriod, setEnableCutOffPeriod] = useState(true);

  // Load S&OP configs from store
  useEffect(() => {
    loadSopCycleConfigs();
  }, [loadSopCycleConfigs]);

  // Initialize selectedConfig from store or use default
  useEffect(() => {
    if (sopCycleConfig && !selectedConfig) {
      setSelectedConfig({
        ...sopCycleConfig,
        companyId: 1, // Will be set from context
        isActive: true
      });
    } else if (!sopCycleConfig && !selectedConfig) {
      // If no config from store, ensure we have the default config
      setSelectedConfig(defaultConfig);
    }
  }, [sopCycleConfig, selectedConfig, defaultConfig]);

  // Load holidays when a config is selected
  useEffect(() => {
    {/*console.log('useEffect triggered - selectedConfig changed:', {
      hasConfig: !!selectedConfig,
      hasHolidays: !!selectedConfig?.workingDaysConfig?.holidays,
      hasHolidayObjects: !!selectedConfig?.workingDaysConfig?.holidayObjects,
      holidayCount: selectedConfig?.workingDaysConfig?.holidays?.length || 0,
      holidayObjectCount: selectedConfig?.workingDaysConfig?.holidayObjects?.length || 0
    });*/}
    
    if (selectedConfig?.workingDaysConfig?.holidayObjects) {
      const holidayObjects = selectedConfig.workingDaysConfig.holidayObjects;
      const ranges: HolidayRange[] = [];
      
      holidayObjects.forEach((holiday, index) => {
        ranges.push({
          id: Date.now().toString() + index, // Use index to ensure unique IDs
          name: holiday.name,
          startDate: parseISO(holiday.startDate),
          endDate: parseISO(holiday.endDate),
          isRange: holiday.isRange
        });
      });
      
      console.log('Setting holiday ranges from config:', ranges);
      setHolidayRanges(ranges);
    } else if (selectedConfig?.workingDaysConfig?.holidays) {
      // Fallback to old format - convert date strings to generic names
      const dates = selectedConfig.workingDaysConfig.holidays;
      const ranges: HolidayRange[] = [];
      
      // Group consecutive dates into ranges
      let currentRange: string[] = [];
      
      dates.sort().forEach(date => {
        if (currentRange.length === 0) {
          currentRange = [date];
        } else {
          const lastDate = parseISO(currentRange[currentRange.length - 1]);
          const currentDate = parseISO(date);
          
          if (isSameDay(addDays(lastDate, 1), currentDate)) {
            currentRange.push(date);
          } else {
            // End current range and start new one
            if (currentRange.length > 0) {
              ranges.push({
                id: Date.now().toString() + Math.random(),
                name: `Holiday ${ranges.length + 1}`,
                startDate: parseISO(currentRange[0]),
                endDate: parseISO(currentRange[currentRange.length - 1]),
                isRange: currentRange.length > 1
              });
            }
            currentRange = [date];
          }
        }
      });
      
      // Add the last range
      if (currentRange.length > 0) {
        ranges.push({
          id: Date.now().toString() + Math.random(),
          name: `Holiday ${ranges.length + 1}`,
          startDate: parseISO(currentRange[0]),
          endDate: parseISO(currentRange[currentRange.length - 1]),
          isRange: currentRange.length > 1
        });
      }
      
      //console.log('Setting holiday ranges from old format:', ranges);
      setHolidayRanges(ranges);
    } else {
      //console.log('No holidays in config, clearing holiday ranges');
      setHolidayRanges([]);
    }
  }, [selectedConfig]);

  // Helper function to check if a date is a working day
  const isWorkingDay = (date: Date, workingDaysConfig: any) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // Check if this day of week is a working day
    if (!workingDaysConfig[dayName]) {
      return false;
    }
    
    // Check if it's a holiday
    const dateString = date.toISOString().split('T')[0];
    if (workingDaysConfig.holidays) {
      // Handle both old string array format and new object format
      if (Array.isArray(workingDaysConfig.holidays)) {
        if (workingDaysConfig.holidays.length > 0 && typeof workingDaysConfig.holidays[0] === 'string') {
          // Old format: string array
          if (workingDaysConfig.holidays.includes(dateString)) {
            return false;
          }
        } else {
          // New format: object array
          for (const holiday of workingDaysConfig.holidays) {
            if (holiday.startDate === dateString || holiday.endDate === dateString) {
              return false;
            }
            // Check if date is in range
            if (holiday.isRange && dateString >= holiday.startDate && dateString <= holiday.endDate) {
              return false;
            }
          }
        }
      }
    }
    
    // Check new holidayObjects format
    if (workingDaysConfig.holidayObjects) {
      for (const holiday of workingDaysConfig.holidayObjects) {
        if (holiday.startDate === dateString || holiday.endDate === dateString) {
          return false;
        }
        // Check if date is in range
        if (holiday.isRange && dateString >= holiday.startDate && dateString <= holiday.endDate) {
          return false;
        }
      }
    }
    
    return true;
  };

  // Helper function to find the nth working day in a month
  const findNthWorkingDay = (year: number, month: number, nth: number, workingDaysConfig: any) => {
    const date = new Date(year, month, 1);
    let workingDaysFound = 0;
    
    while (workingDaysFound < nth && date.getMonth() === month) {
      if (isWorkingDay(date, workingDaysConfig)) {
        workingDaysFound++;
        if (workingDaysFound === nth) {
          return new Date(date);
        }
      }
      date.setDate(date.getDate() + 1);
    }
    
    // If we can't find the nth working day, return the last day of the month
    return new Date(year, month + 1, 0);
  };

  // Helper function to find the nth working day in a quarter
  const findNthWorkingDayInQuarter = (year: number, quarter: number, nth: number, workingDaysConfig: any) => {
    const startMonth = (quarter - 1) * 3;
    const date = new Date(year, startMonth, 1);
    let workingDaysFound = 0;
    
    while (workingDaysFound < nth && date.getMonth() < startMonth + 3) {
      if (isWorkingDay(date, workingDaysConfig)) {
        workingDaysFound++;
        if (workingDaysFound === nth) {
          return new Date(date);
        }
      }
      date.setDate(date.getDate() + 1);
    }
    
    // If we can't find the nth working day, return the last day of the quarter
    return new Date(year, startMonth + 3, 0);
  };

  // Helper function to find the nth working day in a year
  const findNthWorkingDayInYear = (year: number, nth: number, workingDaysConfig: any) => {
    const date = new Date(year, 0, 1);
    let workingDaysFound = 0;
    
    while (workingDaysFound < nth && date.getFullYear() === year) {
      if (isWorkingDay(date, workingDaysConfig)) {
        workingDaysFound++;
        if (workingDaysFound === nth) {
          return new Date(date);
        }
      }
      date.setDate(date.getDate() + 1);
    }
    
    // If we can't find the nth working day, return the last day of the year
    return new Date(year, 11, 31);
  };

  // Generate preview cycles based on configuration
  const generatePreviewCycles = useCallback((config: SopCycleConfig) => {
    const cycles = [];
    // Use current date as base for preview
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Generate cycles for current year + 1 cycle
    const cyclesToGenerate = config.frequency === 'weekly' ? 53 : 
                            config.frequency === 'monthly' ? 13 : 
                            config.frequency === 'quarterly' ? 5 : 2;
    
    for (let i = 0; i < cyclesToGenerate; i++) {
      let cycleStartDate: Date;
      let cycleEndDate: Date;
      let cycleName: string;
      let divisionName = 'Company-wide';
      
      // Determine division name if division-specific
      if (config.divisionId) {
        const division = [...divisions, ...pendingDivisions].find(d => d.id === config.divisionId);
        divisionName = division ? division.name : 'Unknown Division';
      }
      
      switch (config.frequency) {
        case 'weekly':
          // Start from the specified day of week
          const weekStart = new Date(currentYear, 0, 1); // January 1st
          while (weekStart.getDay() !== config.startDay) {
            weekStart.setDate(weekStart.getDate() + 1);
          }
          weekStart.setDate(weekStart.getDate() + (i * 7));
          
          cycleStartDate = new Date(weekStart);
          cycleEndDate = new Date(weekStart);
          cycleEndDate.setDate(cycleEndDate.getDate() + 6);
          
          cycleName = `Week ${getWeekNumber(cycleStartDate)} - ${currentYear + Math.floor(i / 52)}`;
          break;
          
        case 'monthly':
          // Start from the specified day of month
          cycleStartDate = new Date(currentYear + Math.floor(i / 12), i % 12, config.startDay);
          cycleEndDate = new Date(cycleStartDate);
          cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
          cycleEndDate.setDate(cycleEndDate.getDate() - 1);
          
          const monthName = cycleStartDate.toLocaleDateString('en-US', { month: 'long' });
          cycleName = `${monthName} ${cycleStartDate.getFullYear()}`;
          break;
          
        case 'quarterly':
          // Start from the specified day of the specified month in the quarter
          const quarter = Math.floor(i / 4);
          const quarterMonth = (quarter * 3) + (config.startMonth || 1) - 1;
          cycleStartDate = new Date(currentYear + Math.floor(i / 4), quarterMonth, config.startDay);
          cycleEndDate = new Date(cycleStartDate);
          cycleEndDate.setMonth(cycleEndDate.getMonth() + 3);
          cycleEndDate.setDate(cycleEndDate.getDate() - 1);
          
          const quarterNumber = (quarter % 4) + 1;
          cycleName = `Q${quarterNumber} ${cycleStartDate.getFullYear()}`;
          break;
          
        case 'yearly':
          // Start from the specified day of the specified month
          cycleStartDate = new Date(currentYear + i, (config.startMonth || 1) - 1, config.startDay);
          cycleEndDate = new Date(cycleStartDate);
          cycleEndDate.setFullYear(cycleEndDate.getFullYear() + 1);
          cycleEndDate.setDate(cycleEndDate.getDate() - 1);
          
          cycleName = `Year ${cycleStartDate.getFullYear()}`;
          break;
          
        default:
          continue;
      }
      
      // Calculate cut-off date
      let cutOffDate = new Date(cycleEndDate);
      if (enableCutOffPeriod) {
        if (config.workingDaysSettings.cutOffPeriod.useWorkingDays) {
          // Count working days backwards from end date
          let workingDaysCounted = 0;
          while (workingDaysCounted < config.cutOffDays) {
            cutOffDate.setDate(cutOffDate.getDate() - 1);
            if (isWorkingDay(cutOffDate, config.workingDaysConfig)) {
              workingDaysCounted++;
            }
          }
        } else {
          // Use calendar days
          cutOffDate.setDate(cutOffDate.getDate() - config.cutOffDays);
        }
      } else {
        // When cut-off is disabled, set cut-off date to end date (no restriction)
        cutOffDate = new Date(cycleEndDate);
      }
      
      cycles.push({
        name: cycleName,
        startDate: cycleStartDate.toLocaleDateString(),
        endDate: cycleEndDate.toLocaleDateString(),
        cutOffDate: cutOffDate.toLocaleDateString(),
        divisionName: divisionName
      });
    }
    
    return cycles;
  }, [divisions, pendingDivisions, enableCutOffPeriod]);

  // Update preview when configuration changes
  useEffect(() => {
    if (selectedConfig) {
      const preview = generatePreviewCycles(selectedConfig);
      setPreviewCycles(preview);
    }
  }, [selectedConfig, generatePreviewCycles]);

  // Manual trigger to regenerate previews
  const regeneratePreviews = useCallback(() => {
    if (selectedConfig) {
      const preview = generatePreviewCycles(selectedConfig);
      setPreviewCycles(preview);
    }
  }, [selectedConfig, generatePreviewCycles]);

  // Update preview when configuration changes
  useEffect(() => {
    regeneratePreviews();
  }, [regeneratePreviews, enableCutOffPeriod]);

  // Helper function to get ordinal suffix
  const getOrdinalSuffix = (num: number) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) {
      return "st";
    }
    if (j === 2 && k !== 12) {
      return "nd";
    }
    if (j === 3 && k !== 13) {
      return "rd";
    }
    return "th";
  };

  // Helper function to get week number of the year (ISO 8601 standard)
  const getWeekNumber = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    // January 4 is always in week 1
    const week1 = new Date(d.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1
    const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return weekNumber;
  };

  // Helper function to get maximum cut-off days based on frequency
  const getMaxCutOffDays = (frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return 6; // 7 days - 1 day minimum cycle
      case 'monthly':
        return 27; // 31 days - 4 days minimum cycle (for shortest month)
      case 'quarterly':
        return 88; // 92 days - 4 days minimum cycle
      case 'yearly':
        return 361; // 365 days - 4 days minimum cycle
      default:
        return 30;
    }
  };

  // Convert holiday ranges to date strings for the config
  const getHolidayDates = (): string[] => {
    const dates: string[] = [];
    
    holidayRanges.forEach(range => {
      if (range.isRange) {
        // Add all dates in the range
        let currentDate = new Date(range.startDate);
        while (currentDate <= range.endDate) {
          dates.push(format(currentDate, 'yyyy-MM-dd'));
          currentDate = addDays(currentDate, 1);
        }
      } else {
        // Single date
        dates.push(format(range.startDate, 'yyyy-MM-dd'));
      }
    });
    
    return dates;
  };

  // Simplified addHolidayRange function - only manages local state
  const addHolidayRange = () => {
    if (!newHolidayName || !newHolidayStartDate) {
      toast.error('Please fill in the holiday name and start date');
      return;
    }
    
    console.log('Adding holiday - Before:', {
      holidayRanges: holidayRanges.length,
      newHolidayName,
      newHolidayStartDate,
      selectedHolidayYear
    });
    
    // Ensure dates are in the selected year
    const startDate = new Date(newHolidayStartDate);
    startDate.setFullYear(selectedHolidayYear);
    
    const endDate = newHolidayEndDate ? new Date(newHolidayEndDate) : new Date(startDate);
    endDate.setFullYear(selectedHolidayYear);
    
    const newRange: HolidayRange = {
      id: Date.now().toString(),
      name: newHolidayName,
      startDate: startDate,
      endDate: endDate,
      isRange: isHolidayRange && !!newHolidayEndDate
    };
    
    console.log('New holiday range:', newRange);
    
    // Update both holidayRanges and selectedConfig together to avoid race condition
    setHolidayRanges(prev => {
      const updated = [...prev, newRange];
      console.log('Updated holiday ranges:', updated);
      
      // Update the selected config with the new holiday ranges
      if (selectedConfig) {
        const newHolidayObjects = updated.map(range => ({
          name: range.name,
          startDate: format(range.startDate, 'yyyy-MM-dd'),
          endDate: format(range.endDate, 'yyyy-MM-dd'),
          isRange: range.isRange
        }));
        
        const updatedConfig = {
          ...selectedConfig,
          workingDaysConfig: {
            ...selectedConfig.workingDaysConfig,
            holidayObjects: newHolidayObjects
          }
        };
        setSelectedConfig(updatedConfig);
      }
      
      return updated;
    });
    
    // Reset form
    setNewHolidayName('');
    setNewHolidayStartDate(undefined);
    setNewHolidayEndDate(undefined);
    setIsHolidayRange(false);
    setShowHolidayPicker(false);
    
    toast.success('Holiday added to list!');
  };

  // Simplified removeHolidayRange function - only manages local state
  const removeHolidayRange = (id: string) => {
    setHolidayRanges(prev => {
      const updated = prev.filter(range => range.id !== id);
      
      // Update the selected config with the updated holiday ranges
      if (selectedConfig) {
        const newHolidayObjects = updated.map(range => ({
          name: range.name,
          startDate: format(range.startDate, 'yyyy-MM-dd'),
          endDate: format(range.endDate, 'yyyy-MM-dd'),
          isRange: range.isRange
        }));
        
        const updatedConfig = {
          ...selectedConfig,
          workingDaysConfig: {
            ...selectedConfig.workingDaysConfig,
            holidayObjects: newHolidayObjects
          }
        };
        setSelectedConfig(updatedConfig);
      }
      
      return updated;
    });
    
    toast.success('Holiday removed from list!');
  };

  // Get holidays for the selected year
  const getHolidaysForYear = (year: number) => {
    return holidayRanges.filter(range => range.startDate.getFullYear() === year);
  };

  // Working Days Configuration Popup
  const WorkingDaysConfigPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Working Days Configuration
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWorkingDaysConfig(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-6">
          {/* Working Days Selection */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Working Days</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'monday', label: 'Monday' },
                { key: 'tuesday', label: 'Tuesday' },
                { key: 'wednesday', label: 'Wednesday' },
                { key: 'thursday', label: 'Thursday' },
                { key: 'friday', label: 'Friday' },
                { key: 'saturday', label: 'Saturday' },
                { key: 'sunday', label: 'Sunday' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`working-day-${key}`}
                    checked={selectedConfig?.workingDaysConfig?.[key as keyof typeof selectedConfig.workingDaysConfig] as boolean || false}
                    onChange={(e) => {
                      setSelectedConfig(prev => prev ? {
                        ...prev,
                        workingDaysConfig: {
                          ...prev.workingDaysConfig,
                          [key]: e.target.checked
                        }
                      } : defaultConfig);
                      // Regenerate previews after working days change
                      setTimeout(() => regeneratePreviews(), 0);
                    }}
                    className="text-blue-600"
                  />
                  <Label htmlFor={`working-day-${key}`} className="text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Holidays Section */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Company Holidays</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Add company holidays that should be excluded from working days
            </p>
            
            {/* Year Selection */}
            <div className="mb-3">
              <Label htmlFor="holiday-year" className="text-sm">Year</Label>
              <Select
                value={selectedHolidayYear.toString()}
                onValueChange={(value) => setSelectedHolidayYear(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Holidays List */}
            <div className="space-y-2">
              {getHolidaysForYear(selectedHolidayYear).length > 0 ? (
                getHolidaysForYear(selectedHolidayYear)
                  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                  .map((range) => (
                    <div
                      key={range.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {range.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {range.isRange 
                            ? `${format(range.startDate, 'MMM dd, yyyy')} - ${format(range.endDate, 'MMM dd, yyyy')}`
                            : format(range.startDate, 'MMM dd, yyyy')
                          }
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHolidayRange(range.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
              ) : (
                <div className="text-center py-4 text-gray-500 border border-dashed rounded-lg">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No holidays added for {selectedHolidayYear}</p>
                </div>
              )}
            </div>
            
            {/* Add Holiday Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHolidayPicker(true)}
              className="mt-3 w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
            
            {/* Add Holiday Form */}
            {showHolidayPicker && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-900 dark:text-gray-100">Add New Holiday</h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHolidayPicker(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div>
                  <Label htmlFor="holiday-name" className="text-sm">Holiday Name</Label>
                  <Input
                    id="holiday-name"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    placeholder="e.g., New Year's Day, Christmas Break"
                    className="mt-1"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="holiday-range"
                    checked={isHolidayRange}
                    onChange={(e) => setIsHolidayRange(e.target.checked)}
                    className="text-blue-600"
                  />
                  <Label htmlFor="holiday-range" className="text-sm">
                    Date range (multiple days)
                  </Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal mt-1"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {newHolidayStartDate ? format(newHolidayStartDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={newHolidayStartDate}
                          onSelect={setNewHolidayStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {isHolidayRange && (
                    <div>
                      <Label className="text-sm">End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal mt-1"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {newHolidayEndDate ? format(newHolidayEndDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={newHolidayEndDate}
                            onSelect={setNewHolidayEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      addHolidayRange();
                    }}
                    disabled={!newHolidayName || !newHolidayStartDate}
                    className="flex-1"
                  >
                    Add Holiday
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowHolidayPicker(false);
                      setNewHolidayName('');
                      setNewHolidayStartDate(undefined);
                      setNewHolidayEndDate(undefined);
                      setIsHolidayRange(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => setShowWorkingDaysConfig(false)}
            className="flex-1"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            S&OP Cycle Configuration
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Configure automatic S&OP cycle generation with frequency, cut-off periods, and division-specific settings
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* S&OP Configuration Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Configuration Form */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Cycle Configuration
              </h3>
              
            <div className="space-y-4">
                {/* Scope Selection */}
              <div>
                  <Label className="text-sm font-medium">Cycle Scope</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="scope-company"
                        name="scope"
                        value="company"
                        checked={!selectedConfig?.divisionId}
                        onChange={() => setSelectedConfig(prev => prev ? { ...prev, divisionId: undefined } : defaultConfig)}
                        className="text-blue-600"
                      />
                      <Label htmlFor="scope-company" className="text-sm">
                        Company-wide cycles (all divisions)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="scope-division"
                        name="scope"
                        value="division"
                        checked={!!selectedConfig?.divisionId}
                        onChange={() => setSelectedConfig(prev => prev ? { ...prev, divisionId: 1 } : { ...defaultConfig, divisionId: 1 })}
                        className="text-blue-600"
                      />
                      <Label htmlFor="scope-division" className="text-sm">
                        Division-specific cycles
                      </Label>
                    </div>
                  </div>
              </div>

                {/* Division Selection (if division-specific) */}
                {selectedConfig?.divisionId && (
              <div>
                    <Label htmlFor="division-select">Division</Label>
                    <Select 
                      value={selectedConfig.divisionId?.toString()} 
                      onValueChange={(value) => setSelectedConfig(prev => prev ? { ...prev, divisionId: parseInt(value) } : { ...defaultConfig, divisionId: parseInt(value) })}
                    >
                  <SelectTrigger>
                        <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                        {divisions.map((division) => (
                          <SelectItem key={division.id} value={division.id.toString()}>
                              {division.name}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Frequency Selection */}
                <div>
                  <Label htmlFor="frequency">Cycle Frequency</Label>
                  <Select 
                    value={selectedConfig?.frequency || 'monthly'}
                    onValueChange={(value) => {
                      const newConfig = {
                        ...selectedConfig,
                        frequency: value as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
                        startDay: value === 'weekly' ? 1 : 1, // Reset to 1 for new frequency
                        startMonth: value === 'quarterly' || value === 'yearly' ? 1 : undefined
                      };
                      setSelectedConfig(newConfig);
                      // Regenerate previews after frequency change
                      setTimeout(() => regeneratePreviews(), 0);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Parameters */}
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-day">
                      {selectedConfig?.workingDaysSettings.startDate.useWorkingDays ? 'Working Day Number' : 'Start Day'}
                    </Label>
                    <Input
                      id="start-day"
                      type="number"
                      min="1"
                      max={selectedConfig?.frequency === 'weekly' ? '7' : '31'}
                      value={selectedConfig?.startDay ?? 1}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value);
                        if (!isNaN(newValue) && newValue >= 1) {
                          setSelectedConfig(prev => prev ? { ...prev, startDay: newValue } : { ...defaultConfig, startDay: newValue });
                        }
                      }}
                      placeholder={selectedConfig?.frequency === 'weekly' ? '1-7' : '1-31'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedConfig?.workingDaysSettings.startDate.useWorkingDays 
                        ? (selectedConfig?.frequency === 'weekly' 
                            ? '1st working day of week, 2nd working day, etc.' 
                            : '1st working day of period, 2nd working day, etc.')
                        : (selectedConfig?.frequency === 'weekly' 
                            ? '1=Monday, 7=Sunday' 
                            : 'Day of month')
                      }
                    </p>
                    
                    {/* Start Date Working Days Toggle */}
                    <div className="mt-2 flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="start-working-days"
                        checked={selectedConfig?.workingDaysSettings.startDate.useWorkingDays || false}
                        onChange={(e) => setSelectedConfig(prev => prev ? {
                          ...prev,
                          workingDaysSettings: {
                            ...prev.workingDaysSettings,
                            startDate: {
                              ...prev.workingDaysSettings.startDate,
                              useWorkingDays: e.target.checked
                            }
                          }
                        } : defaultConfig)}
                        className="text-blue-600"
                      />
                      <Label htmlFor="start-working-days" className="text-xs">
                        Use working days for start date
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowWorkingDaysConfig(true)}
                        className="h-4 w-4 p-0 text-gray-400 hover:text-gray-600"
                        title="Configure working days"
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {(selectedConfig?.frequency === 'quarterly' || selectedConfig?.frequency === 'yearly') && (
                    <div>
                      <Label htmlFor="start-month">Start Month</Label>
                      <Select 
                        value={selectedConfig?.startMonth?.toString() || '1'} 
                        onValueChange={(value) => setSelectedConfig(prev => prev ? { ...prev, startMonth: parseInt(value) } : { ...defaultConfig, startMonth: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">January</SelectItem>
                          <SelectItem value="2">February</SelectItem>
                          <SelectItem value="3">March</SelectItem>
                          <SelectItem value="4">April</SelectItem>
                          <SelectItem value="5">May</SelectItem>
                          <SelectItem value="6">June</SelectItem>
                          <SelectItem value="7">July</SelectItem>
                          <SelectItem value="8">August</SelectItem>
                          <SelectItem value="9">September</SelectItem>
                          <SelectItem value="10">October</SelectItem>
                          <SelectItem value="11">November</SelectItem>
                          <SelectItem value="12">December</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>


                {/* Cut-off Period Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enable-cutoff"
                    checked={enableCutOffPeriod}
                    onChange={(e) => setEnableCutOffPeriod(e.target.checked)}
                    className="text-blue-600"
                  />
                  <Label htmlFor="enable-cutoff" className="text-sm font-medium">
                    Enable Cut-off Period
                  </Label>
                </div>

                {/* Cut-off Period Options (only shown when enabled) */}
                {enableCutOffPeriod && (
                  <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div>
                      <Label htmlFor="cutoff-days">Cut-off Period (days before cycle end)</Label>
                      <Input
                        id="cutoff-days"
                        type="number"
                        min="0"
                        max={getMaxCutOffDays(selectedConfig?.frequency || 'monthly')}
                        value={selectedConfig?.cutOffDays ?? 3}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          if (!isNaN(newValue) && newValue >= 0) {
                            setSelectedConfig(prev => prev ? { ...prev, cutOffDays: newValue } : { ...defaultConfig, cutOffDays: newValue });
                          }
                        }}
                        placeholder="3"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Regular users cannot modify forecasts during this period. Only managers can.
                        <br />
                        <span className="text-blue-600">
                          Maximum: {getMaxCutOffDays(selectedConfig?.frequency || 'monthly')} days for {selectedConfig?.frequency || 'monthly'} cycles
                        </span>
                      </p>
                      
                      {/* Cut-off Period Working Days Toggle */}
                      <div className="mt-2 flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="cutoff-working-days"
                          checked={selectedConfig?.workingDaysSettings.cutOffPeriod.useWorkingDays || false}
                          onChange={(e) => setSelectedConfig(prev => prev ? {
                            ...prev,
                            workingDaysSettings: {
                              ...prev.workingDaysSettings,
                              cutOffPeriod: {
                                ...prev.workingDaysSettings.cutOffPeriod,
                                useWorkingDays: e.target.checked
                              }
                            }
                          } : defaultConfig)}
                          className="text-blue-600"
                        />
                        <Label htmlFor="cutoff-working-days" className="text-xs">
                          Use working days for cut-off period
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowWorkingDaysConfig(true)}
                          className="h-4 w-4 p-0 text-gray-400 hover:text-gray-600"
                          title="Configure working days"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Preview Panel */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Cycle Preview
              </h3>
              
              {selectedConfig ? (
            <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Configuration Summary
                    </h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <div>• Scope: {selectedConfig.divisionId ? 'Division-specific' : 'Company-wide'}</div>
                      <div>• Frequency: {selectedConfig.frequency}</div>
                      <div>• Start: {selectedConfig.startDay}{selectedConfig.startMonth ? `/${selectedConfig.startMonth}` : ''} {selectedConfig.workingDaysSettings.startDate.useWorkingDays ? 'working day' : 'day'}</div>
                      <div>• Cut-off: {enableCutOffPeriod ? `${selectedConfig.cutOffDays} ${selectedConfig.workingDaysSettings.cutOffPeriod.useWorkingDays ? 'working days' : 'days'} before end` : 'Disabled'}</div>
                      {(selectedConfig.workingDaysSettings.startDate.useWorkingDays || selectedConfig.workingDaysSettings.cutOffPeriod.useWorkingDays) && selectedConfig.workingDaysConfig && (
                        <div>• Working Days: {Object.entries(selectedConfig.workingDaysConfig)
                          .filter(([key, value]) => key !== 'holidays' && key !== 'holidayObjects' && value)
                          .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
                          .join(', ')}</div>
                      )}
                    </div>
                </div>
                  
                <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      Cycle Preview ({previewCycles.length} examples - 1 year + 1 cycle)
                    </h4>
                    <p className="text-xs text-gray-500 mb-3">
                      This shows how cycles would look based on your configuration. Actual cycles are created automatically from your data.
                    </p>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {previewCycles.map((cycle, index) => (
                        <div
                          key={index}
                          className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <p className="font-medium text-gray-900 dark:text-gray-100">{cycle.name}</p>
                          <Badge variant="secondary" className="text-xs">
                                  {cycle.divisionName}
                          </Badge>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                                <div>📅 {cycle.startDate} - {cycle.endDate}</div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Cut-off: {enableCutOffPeriod ? cycle.cutOffDate : 'No restriction'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Configure cycle settings to see preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Working Days Configuration Popup */}
          {showWorkingDaysConfig && <WorkingDaysConfigPopup />}
        </CardContent>
      </Card>
    </div>
  );
}; 