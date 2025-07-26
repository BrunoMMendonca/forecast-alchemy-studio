# Calendar Holiday Selection for S&OP Cycles

## Overview

The S&OP cycle system now includes a sophisticated calendar interface for holiday selection, replacing the manual text input with an intuitive visual date picker. This enhancement makes it much easier for administrators to configure company holidays and ensures accurate working day calculations.

## Key Features

### 🎯 **Visual Calendar Interface**
- **Date Picker**: Click to select individual dates or date ranges
- **Range Selection**: Support for multi-day holiday periods (e.g., Christmas break)
- **Visual Feedback**: Clear indication of selected dates and ranges

### 🏢 **Preset Holiday Options**
- **Common US Holidays**: Quick-add buttons for standard holidays
- **Smart Detection**: Prevents duplicate holiday entries
- **Easy Management**: Add/remove holidays with visual confirmation

### 📅 **Holiday Range Support**
- **From -> To Selection**: Choose start and end dates for holiday periods
- **Automatic Date Generation**: All dates in range are automatically added
- **Flexible Configuration**: Support for both single days and ranges

## UI Components

### Holiday Management Interface

#### Holiday Display
```tsx
{holidayRanges.length > 0 && (
  <div className="mt-2 space-y-2">
    {holidayRanges.map((range) => (
      <div key={range.id} className="flex items-center justify-between p-2 bg-blue-50 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium text-sm">{range.name}</div>
          <div className="text-xs text-blue-700">
            {range.isRange 
              ? `${format(range.startDate, 'MMM dd, yyyy')} - ${format(range.endDate, 'MMM dd, yyyy')}`
              : format(range.startDate, 'MMM dd, yyyy')
            }
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => removeHolidayRange(range.id)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
  </div>
)}
```

#### Add Holiday Form
```tsx
{showHolidayPicker && (
  <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
    <div>
      <Label>Holiday Name</Label>
      <Input
        value={newHolidayName}
        onChange={(e) => setNewHolidayName(e.target.value)}
        placeholder="e.g., New Year's Day, Christmas Break"
      />
    </div>
    
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={isHolidayRange}
        onChange={(e) => setIsHolidayRange(e.target.checked)}
      />
      <Label>Date range (multiple days)</Label>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label>Start Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
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
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                {newHolidayEndDate ? format(newHolidayEndDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={newHolidayEndDate}
                onSelect={setNewHolidayEndDate}
                disabled={(date) => date < (newHolidayStartDate || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  </div>
)}
```

#### Preset Holidays
```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium">Quick Add Common Holidays</Label>
  <div className="grid grid-cols-2 gap-2">
    {presetHolidays.map((holiday) => (
      <Button
        key={holiday.date}
        variant="outline"
        size="sm"
        onClick={() => addPresetHoliday(holiday)}
        disabled={isPresetHolidayAdded(holiday.date)}
        className="justify-start text-xs h-8"
      >
        <CalendarDays className="h-3 w-3 mr-1" />
        {holiday.name}
        {isPresetHolidayAdded(holiday.date) && (
          <Badge variant="secondary" className="ml-1 text-xs">
            Added
          </Badge>
        )}
      </Button>
    ))}
  </div>
</div>
```

## Data Structure

### Holiday Range Interface
```typescript
interface HolidayRange {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isRange: boolean;
}
```

### Preset Holidays
```typescript
const presetHolidays = [
  { name: "New Year's Day", date: '2024-01-01' },
  { name: "Martin Luther King Jr. Day", date: '2024-01-15' },
  { name: "Presidents' Day", date: '2024-02-19' },
  { name: "Memorial Day", date: '2024-05-27' },
  { name: "Independence Day", date: '2024-07-04' },
  { name: "Labor Day", date: '2024-09-02' },
  { name: "Columbus Day", date: '2024-10-14' },
  { name: "Veterans Day", date: '2024-11-11' },
  { name: "Thanksgiving", date: '2024-11-28' },
  { name: "Christmas Day", date: '2024-12-25' }
];
```

## Helper Functions

### Convert Holiday Ranges to Date Strings
```typescript
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
```

### Add Holiday Range
```typescript
const addHolidayRange = () => {
  if (!newHolidayName || !newHolidayStartDate) return;
  
  const newRange: HolidayRange = {
    id: Date.now().toString(),
    name: newHolidayName,
    startDate: newHolidayStartDate,
    endDate: newHolidayEndDate || newHolidayStartDate,
    isRange: isHolidayRange && !!newHolidayEndDate
  };
  
  setHolidayRanges(prev => [...prev, newRange]);
  
  // Update the selected config with new holidays
  if (selectedConfig) {
    const updatedConfig = {
      ...selectedConfig,
      workingDaysConfig: {
        ...selectedConfig.workingDaysConfig,
        holidays: getHolidayDates()
      }
    };
    setSelectedConfig(updatedConfig);
  }
};
```

### Preset Holiday Management
```typescript
const addPresetHoliday = (holiday: { name: string; date: string }) => {
  const newRange: HolidayRange = {
    id: Date.now().toString(),
    name: holiday.name,
    startDate: parseISO(holiday.date),
    endDate: parseISO(holiday.date),
    isRange: false
  };
  
  setHolidayRanges(prev => [...prev, newRange]);
  // Update config...
};

const isPresetHolidayAdded = (date: string) => {
  return holidayRanges.some(range => 
    format(range.startDate, 'yyyy-MM-dd') === date && !range.isRange
  );
};
```

## Usage Examples

### Single Day Holiday
1. Click "Add Holiday"
2. Enter holiday name: "Independence Day"
3. Select start date: July 4, 2024
4. Leave "Date range" unchecked
5. Click "Add Holiday"

**Result**: Adds 2024-07-04 to holidays list

### Multi-Day Holiday Range
1. Click "Add Holiday"
2. Enter holiday name: "Christmas Break"
3. Check "Date range (multiple days)"
4. Select start date: December 23, 2024
5. Select end date: December 27, 2024
6. Click "Add Holiday"

**Result**: Adds 2024-12-23, 2024-12-24, 2024-12-25, 2024-12-26, 2024-12-27 to holidays list

### Preset Holiday
1. Click "Independence Day" in preset holidays section
2. Holiday is automatically added with correct date

**Result**: Adds 2024-07-04 to holidays list with name "Independence Day"

## Business Logic

### Holiday Range Processing
1. **Single Day**: Adds one date to holidays list
2. **Date Range**: Adds all dates from start to end (inclusive)
3. **Validation**: Ensures end date is not before start date
4. **Deduplication**: Prevents duplicate holiday entries

### Working Day Calculation
1. **Holiday Check**: Excludes all holiday dates from working days
2. **Range Expansion**: Multi-day holidays are expanded to individual dates
3. **Nth Working Day**: Correctly calculates working days excluding holidays

### Data Persistence
1. **JSONB Storage**: Holidays stored as array of date strings in database
2. **Range Reconstruction**: Consecutive dates are grouped back into ranges for display
3. **Config Updates**: Holiday changes immediately update cycle preview

## Validation Rules

### Date Format Validation
- **Required Format**: YYYY-MM-DD
- **Date Range**: Valid calendar dates
- **Logical Order**: End date must be >= start date

### Holiday Name Validation
- **Required**: Holiday name cannot be empty
- **Length**: Reasonable length limits
- **Uniqueness**: Prevents duplicate names (optional)

### Preset Holiday Validation
- **Already Added**: Prevents adding same preset holiday twice
- **Date Conflicts**: Handles overlapping holiday ranges
- **Year Handling**: Supports different years for same holiday

## Testing

### Test Scenarios
1. **Single Day Selection**: Verify individual holiday dates are added correctly
2. **Date Range Selection**: Verify all dates in range are added
3. **Preset Holidays**: Verify quick-add functionality works
4. **Validation**: Verify invalid dates are rejected
5. **Working Day Impact**: Verify holidays affect cycle generation

### Test Script
```bash
node test-calendar-holiday-selection.js
```

This script tests:
- Calendar holiday selection interface
- Holiday range configuration
- Preset holiday functionality
- Validation rules
- Working day calculation with holidays

## Benefits

### User Experience Benefits
1. **Visual Interface**: Intuitive calendar selection vs manual typing
2. **Quick Add**: Preset holidays for common scenarios
3. **Range Support**: Easy selection of multi-day periods
4. **Error Prevention**: Validation prevents invalid dates

### Business Benefits
1. **Accuracy**: Reduces errors in holiday configuration
2. **Efficiency**: Faster holiday setup process
3. **Flexibility**: Supports various holiday patterns
4. **Consistency**: Standardized holiday management

### Technical Benefits
1. **Data Integrity**: Proper date format validation
2. **Performance**: Efficient date range processing
3. **Maintainability**: Clear separation of concerns
4. **Extensibility**: Easy to add new preset holidays

## Future Enhancements

### Potential Features
1. **Regional Holidays**: Country-specific preset holidays
2. **Recurring Holidays**: Annual holiday patterns
3. **Holiday Templates**: Predefined holiday sets for different industries
4. **Import/Export**: CSV import for bulk holiday management
5. **Holiday Calendar**: Visual calendar view of all holidays

### Integration Opportunities
1. **HR Systems**: Import holidays from HR software
2. **Calendar APIs**: Sync with Google Calendar, Outlook
3. **Holiday APIs**: Automatic holiday detection by country
4. **Time Tracking**: Integration with time tracking systems

## Migration

### From Text Input to Calendar
1. **Backward Compatibility**: Existing holiday configurations continue to work
2. **Data Conversion**: Text dates are automatically converted to calendar format
3. **UI Enhancement**: New interface provides better user experience
4. **Validation**: Improved validation prevents errors

The calendar holiday selection feature significantly improves the user experience for configuring company holidays in the S&OP cycle system, making it more intuitive and error-free. 
 
 
 
 
 
 
 
 
 