# Working Days Support in S&OP Cycle System

## Overview

The enhanced S&OP cycle system now supports both **regular days** and **working days** for cycle generation. This allows administrators to configure cycles that start on specific calendar dates (e.g., 1st of month) or on specific working days (e.g., 1st working day of month), making the system much more practical for real business scenarios.

## Key Features

### 🎯 **Day Type Selection**
- **Regular Days**: Start on specific calendar dates (e.g., 1st of month)
- **Working Days**: Start on specific working days (e.g., 1st working day of month)

### 🏢 **Working Days Configuration**
- **Day of Week Selection**: Choose which days are considered working days
- **Holiday Management**: Configure company-specific holidays
- **Flexible Scheduling**: Support for different working patterns (5-day, 6-day, etc.)

### 📅 **Automatic Working Day Calculation**
- **Nth Working Day**: Find the 1st, 2nd, 3rd, etc. working day of a period
- **Holiday Awareness**: Automatically skip holidays when calculating working days
- **Fallback Logic**: Handle edge cases when nth working day doesn't exist

## Database Schema Updates

### Enhanced `sop_cycle_configs` Table

```sql
CREATE TABLE sop_cycle_configs (
    -- ... existing fields ...
    day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working')),
    working_days_config JSONB, -- Configuration for working days and holidays
    -- ... existing fields ...
);
```

### Working Days Configuration Structure

```json
{
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": false,
  "sunday": false,
  "holidays": [
    "2024-01-01",
    "2024-07-04",
    "2024-12-25"
  ]
}
```

## Database Functions

### Working Day Calculation Functions

#### `is_working_day(date, working_days_config)`
Checks if a given date is a working day based on:
- Day of week configuration
- Holiday list

#### `find_nth_working_day_in_month(year, month, nth, working_days_config)`
Finds the nth working day in a specific month.

#### `find_nth_working_day_in_quarter(year, quarter, nth, working_days_config)`
Finds the nth working day in a specific quarter.

#### `find_nth_working_day_in_year(year, nth, working_days_config)`
Finds the nth working day in a specific year.

## Frontend Implementation

### Enhanced UI Components

#### Day Type Selection
```tsx
<div>
  <Label className="text-sm font-medium">Day Type</Label>
  <div className="mt-2 space-y-2">
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        id="daytype-regular"
        name="daytype"
        value="regular"
        checked={selectedConfig?.dayType === 'regular'}
        onChange={() => setSelectedConfig(prev => ({ ...prev, dayType: 'regular' }))}
      />
      <Label htmlFor="daytype-regular">Regular days (e.g., 1st of month)</Label>
    </div>
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        id="daytype-working"
        name="daytype"
        value="working"
        checked={selectedConfig?.dayType === 'working'}
        onChange={() => setSelectedConfig(prev => ({ ...prev, dayType: 'working' }))}
      />
      <Label htmlFor="daytype-working">Working days (e.g., 1st working day of month)</Label>
    </div>
  </div>
</div>
```

#### Working Days Configuration Panel
```tsx
{selectedConfig?.dayType === 'working' && (
  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
    <h4 className="font-medium">Working Days Configuration</h4>
    
    {/* Day of week selection */}
    <div className="grid grid-cols-2 gap-4">
      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
        <div key={day} className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={`working-${day}`}
            checked={selectedConfig?.workingDaysConfig?.[day] || false}
            onChange={(e) => updateWorkingDaysConfig(day, e.target.checked)}
          />
          <Label htmlFor={`working-${day}`} className="text-sm capitalize">
            {day}
          </Label>
        </div>
      ))}
    </div>
    
    {/* Holiday configuration */}
    <div>
      <Label htmlFor="holidays">Holidays (optional)</Label>
      <Textarea
        id="holidays"
        value={selectedConfig?.workingDaysConfig?.holidays?.join('\n') || ''}
        onChange={(e) => updateHolidays(e.target.value)}
        placeholder="Enter holiday dates (YYYY-MM-DD format, one per line)"
        rows={4}
      />
    </div>
  </div>
)}
```

### Helper Functions

#### Working Day Calculation
```typescript
const isWorkingDay = (date: Date, workingDaysConfig: any) => {
  const dayOfWeek = date.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  
  // Check if this day of week is a working day
  if (!workingDaysConfig[dayName]) {
    return false;
  }
  
  // Check if it's a holiday
  const dateString = date.toISOString().split('T')[0];
  if (workingDaysConfig.holidays && workingDaysConfig.holidays.includes(dateString)) {
    return false;
  }
  
  return true;
};
```

#### Nth Working Day Finder
```typescript
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
  
  // Fallback to last day of month
  return new Date(year, month + 1, 0);
};
```

## Usage Examples

### Monthly Regular Days
```json
{
  "frequency": "monthly",
  "dayType": "regular",
  "startDay": 1,
  "description": "Monthly cycles starting on the 1st of each month"
}
```
**Generated Cycles:**
- January 2024: 2024-01-01 to 2024-01-31
- February 2024: 2024-02-01 to 2024-02-29
- March 2024: 2024-03-01 to 2024-03-31

### Monthly Working Days
```json
{
  "frequency": "monthly",
  "dayType": "working",
  "startDay": 1,
  "description": "Monthly cycles starting on the 1st working day of each month",
  "workingDaysConfig": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "holidays": ["2024-01-01", "2024-07-04", "2024-12-25"]
  }
}
```
**Generated Cycles:**
- January 2024 (1st working day): 2024-01-02 to 2024-01-31 (skips New Year's Day)
- February 2024 (1st working day): 2024-02-01 to 2024-02-29
- March 2024 (1st working day): 2024-03-01 to 2024-03-31

### Weekly Working Days
```json
{
  "frequency": "weekly",
  "dayType": "working",
  "startDay": 1,
  "description": "Weekly cycles starting on the 1st working day of each week",
  "workingDaysConfig": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false
  }
}
```
**Generated Cycles:**
- Week 1 2024 (1st working day): 2024-01-01 to 2024-01-07
- Week 2 2024 (1st working day): 2024-01-08 to 2024-01-14
- Week 3 2024 (1st working day): 2024-01-15 to 2024-01-21

### Quarterly Working Days
```json
{
  "frequency": "quarterly",
  "dayType": "working",
  "startDay": 1,
  "startMonth": 1,
  "description": "Quarterly cycles starting on the 1st working day of each quarter",
  "workingDaysConfig": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "holidays": ["2024-01-01", "2024-07-04", "2024-09-02"]
  }
}
```
**Generated Cycles:**
- Q1 2024 (1st working day): 2024-01-02 to 2024-03-31
- Q2 2024 (1st working day): 2024-04-01 to 2024-06-30
- Q3 2024 (1st working day): 2024-07-01 to 2024-09-30

## Business Logic

### Working Day Calculation Rules

1. **Day of Week Check**: Verify the day is marked as a working day
2. **Holiday Check**: Skip dates marked as holidays
3. **Nth Working Day**: Count working days from the start of the period
4. **Fallback Logic**: If nth working day doesn't exist, use the last day of the period

### Cycle Naming

When using working days, cycle names include an indicator:
- **Regular**: "January 2024"
- **Working**: "January 2024 (1st working day)"

### Validation Rules

1. **Required Fields**: `dayType` must be 'regular' or 'working'
2. **Working Days Config**: Required when `dayType` is 'working'
3. **Day Selection**: At least one day must be marked as a working day
4. **Holiday Format**: Holidays must be in YYYY-MM-DD format
5. **Start Day Range**: Validated based on frequency and day type

## API Endpoints

### Enhanced Configuration Creation
```http
POST /api/sop-cycle-configs
Content-Type: application/json

{
  "divisionId": null,
  "frequency": "monthly",
  "dayType": "working",
  "startDay": 1,
  "cutOffDays": 3,
  "description": "Monthly working days cycles",
  "autoGenerate": true,
  "generateFromDate": "2024-01-01",
  "generateCount": 12,
  "workingDaysConfig": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": false,
    "sunday": false,
    "holidays": ["2024-01-01", "2024-07-04"]
  }
}
```

### Response
```json
{
  "status": "ok",
  "config": {
    "id": 1,
    "company_id": 1,
    "division_id": null,
    "frequency": "monthly",
    "day_type": "working",
    "start_day": 1,
    "working_days_config": {
      "monday": true,
      "tuesday": true,
      "wednesday": true,
      "thursday": true,
      "friday": true,
      "saturday": false,
      "sunday": false,
      "holidays": ["2024-01-01", "2024-07-04"]
    }
  },
  "message": "S&OP cycle configuration created successfully"
}
```

## Testing

### Test Script
Use the provided test script to verify working days functionality:

```bash
node test-working-days-sop.js
```

This script tests:
- Regular days configuration
- Working days configuration
- Weekly working days
- Quarterly working days
- Validation rules
- Cycle generation
- Configuration retrieval

### Test Scenarios

1. **Basic Working Days**: 5-day work week with holidays
2. **6-Day Work Week**: Including Saturday as working day
3. **Holiday Impact**: Verify cycles skip holidays correctly
4. **Edge Cases**: Month with many holidays, leap years
5. **Validation**: Invalid configurations are rejected

## Migration

### From Regular Days to Working Days

1. **Backward Compatibility**: Existing regular day configurations continue to work
2. **Gradual Migration**: Convert configurations one by one
3. **Data Preservation**: Existing cycles are not affected
4. **Validation**: New working days configurations are validated

### Database Migration

```sql
-- Add new columns to existing table
ALTER TABLE sop_cycle_configs 
ADD COLUMN day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working')),
ADD COLUMN working_days_config JSONB;

-- Create indexes for performance
CREATE INDEX idx_sop_cycle_configs_day_type ON sop_cycle_configs(day_type);
CREATE INDEX idx_sop_cycle_configs_working_days ON sop_cycle_configs USING GIN(working_days_config);
```

## Benefits

### Business Benefits
1. **Realistic Scheduling**: Cycles align with actual business operations
2. **Holiday Awareness**: Automatically accounts for company holidays
3. **Flexible Work Patterns**: Support for different working schedules
4. **Consistent Planning**: Predictable cycle start dates

### Technical Benefits
1. **Automatic Calculation**: No manual date adjustments needed
2. **Configurable**: Easy to modify working days and holidays
3. **Scalable**: Handles multiple divisions with different schedules
4. **Maintainable**: Clear separation of regular vs working day logic

## Future Enhancements

### Potential Features
1. **Regional Holidays**: Automatic holiday detection by country/region
2. **Shift Patterns**: Support for multiple shifts per day
3. **Dynamic Holidays**: API integration for holiday calendars
4. **Working Hours**: Include time-of-day considerations
5. **Exception Handling**: Special working days (e.g., half-days)

### Integration Opportunities
1. **HR Systems**: Import working schedules from HR software
2. **Calendar APIs**: Sync with Google Calendar, Outlook
3. **Holiday APIs**: Automatic holiday detection
4. **Time Tracking**: Integration with time tracking systems 
 
 
 
 
 
 
 
 
 