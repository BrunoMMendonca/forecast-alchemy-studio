# CSV Import Validation & Error Handling: Implementation Guide

*This document outlines the comprehensive improvements made to CSV import validation and error handling, ensuring users cannot proceed with invalid data and providing clear guidance on how to fix issues.*

## 1. Core Problem / Use Case

The CSV import system needed robust validation to prevent users from importing invalid or poorly parsed data. Previous validation was too permissive, allowing invalid formats to pass through and causing issues downstream in the forecasting workflow.

**Key Requirements:**
- Strict format validation for dates and numbers
- Visual error indicators in preview tables
- Progression blocking when validation errors exist
- Consistent error handling UI across all states
- Clear guidance for fixing validation issues
- Column count validation to prevent separator mismatch

---

## 2. How It Works: The Validation System

### A. Backend Validation Logic

**Enhanced Number Format Validation**
```javascript
// Stricter validation with regex patterns
const parseNumberWithFormat = (value, format) => {
  // Validates thousands separators, decimal places
  // Checks for required format elements
  // Returns NaN for invalid numbers
  // Adds "❌ Invalid (format)" marker to invalid values
};
```

**Date Format Validation**
```javascript
// Strict validation based on selected format
const parseDateWithFormat = (value, format) => {
  // Returns null for invalid dates
  // Adds "❌ Invalid (format)" marker to invalid values
};
```

**Validation Markers**
- Backend adds `❌ Invalid (format)` markers to invalid values
- Frontend detects these markers to identify validation errors
- Invalid values highlighted in red in preview table

### B. Frontend Error Detection

**Format Error Detection**
```javascript
const hasFormatErrors = () => {
  if (!data.length || !header.length) return false;
  
  // Check for invalid format markers in the data
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    for (const headerName of header) {
      const cellValue = row[headerName];
      if (typeof cellValue === 'string' && cellValue.includes('❌ Invalid')) {
        return true;
      }
    }
  }
  
  // Check for invalid format markers in headers
  for (const headerName of header) {
    if (typeof headerName === 'string' && headerName.includes('❌ Invalid')) {
      return true;
    }
  }
  
  return false;
};
```

**Column Count Validation**
```javascript
const hasInsufficientColumns = () => {
  return header.length < 4;
};
```

**Combined Validation**
```javascript
const hasValidationErrors = () => {
  return hasFormatErrors() || hasInsufficientColumns();
};
```

### C. Visual Error Indicators

**Error Highlighting**
- **Invalid Headers**: Red background with red border (`bg-red-100 border-red-400`)
- **Invalid Cells**: Red background with left red border (`bg-red-50 border-l-4 border-red-400`)
- **Separator Dropdown**: Red border when insufficient columns
- **Validation Warning**: ErrorHandler-style warning banner

**Progression Control**
- **Disabled Button**: "Next: Mapping" button disabled when errors exist
- **Tooltip**: Explains why button is disabled
- **Visual Feedback**: Button appears grayed out (`opacity-50 cursor-not-allowed`)

---

## 3. Standardized Error Handling

### A. ErrorHandler Component

**Error Types**
- `no-data`: Unable to preview data
- `format-issues`: Format validation problems
- `parsing-error`: CSV parsing errors
- `loading`: Processing state
- `ai-error`: AI processing failures

**Consistent Styling**
- Centered layout with dashed border
- Icon, title, message, suggestions structure
- Helpful links for format assistance
- Action buttons (Back, Try Again)

### B. Validation Warning Integration

**Warning Display**
```javascript
{hasValidationErrors() && (
  <div className="mt-4 text-center py-6 border border-dashed rounded-lg bg-slate-50">
    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
    <div className="text-slate-700 font-medium mb-2">
      {hasInsufficientColumns() && hasFormatErrors() 
        ? 'Multiple validation issues detected'
        : hasInsufficientColumns()
        ? 'Insufficient columns detected'
        : 'Format validation issues detected'
      }
    </div>
    <div className="text-slate-500 text-sm mb-4">
      {/* Dynamic message based on error type */}
    </div>
    
    <div className="text-left max-w-md mx-auto">
      <div className="text-xs text-slate-600 font-medium mb-2">Suggestions:</div>
      <ul className="text-xs text-slate-500 space-y-1 mb-4">
        {/* Contextual suggestions */}
      </ul>
    </div>

    {/* Helpful links */}
    <div className="border-t pt-4 mt-4">
      <div className="text-xs text-slate-600 font-medium mb-2">Need help with formats?</div>
      <div className="flex flex-wrap gap-2 justify-center text-xs">
        <button onClick={() => onFormatHelp?.('date')} className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Date Format Help
        </button>
        <button onClick={() => onFormatHelp?.('number')} className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
          <Hash className="w-3 h-3" />
          Number Format Help
        </button>
        <button onClick={() => window.open('https://help.example.com/csv-structure', '_blank')} className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
          <FileText className="w-3 h-3" />
          CSV Structure Guide
        </button>
      </div>
    </div>
  </div>
)}
```

**Consistent UX**
- Same visual style as ErrorHandler component
- Icon size, layout, typography consistency
- Suggestions and helpful links integration
- Professional appearance across all error states

---

## 4. Key Code Pointers

| Area                     | File / Component                     | Key Function / Hook         | Purpose                                                      |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| **Preview Step**         | `src/components/CsvImportWizard/PreviewStep.tsx` | `hasFormatErrors`, `hasInsufficientColumns` | Detects validation errors and controls progression           |
| **Error Handler**        | `src/components/CsvImportWizard/ErrorHandler.tsx` | `ErrorHandler`              | Standardized error display component                         |
| **Backend Validation**   | `src/backend/routes.js`              | `POST /api/generate-preview` | Adds validation markers to preview data                     |
| **Format Validation**    | `src/utils/csvUtils.ts`              | `parseNumberWithFormat`     | Validates number formats with strict regex                   |
| **Date Validation**      | `src/utils/dateUtils.ts`             | `parseDateWithFormat`       | Validates date formats                                       |
| **Visual Indicators**    | `src/components/CsvImportWizard/PreviewStep.tsx` | Table rendering logic | Highlights invalid cells and headers in red                  |

---

## 5. User Experience Flow

### A. Successful Validation
1. **File Upload**: User selects CSV file
2. **Auto-Detection**: System detects formats automatically
3. **Preview Display**: Shows data with validation results
4. **Format Adjustment**: User can adjust formats if needed
5. **Validation**: System validates all data formats
6. **Progression**: User proceeds to mapping step

### B. Error Handling Flow
1. **Error Detection**: System identifies validation issues
2. **Visual Feedback**: Errors highlighted in preview table
3. **Warning Display**: ErrorHandler-style warning banner
4. **Progression Blocked**: "Next: Mapping" button disabled
5. **User Guidance**: Suggestions and helpful links provided
6. **Format Adjustment**: User fixes format issues
7. **Re-validation**: System re-validates after changes
8. **Progression**: User proceeds when errors resolved

---

## 6. Validation Rules

### A. Date Format Validation
- **Supported Formats**: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy, yyyy/mm/dd
- **Validation**: Strict format matching with selected format
- **Error Marking**: Invalid dates marked with `❌ Invalid (date format)`

### B. Number Format Validation
- **Supported Formats**: 1,234.56, 1.234,56, 1234.56, 1234,56, 1 234,56, 1 234.56, 1234
- **Validation**: Strict regex patterns for each format
- **Thousands Separators**: Validates required separators
- **Decimal Places**: Validates decimal format
- **Error Marking**: Invalid numbers marked with `❌ Invalid (number format)`

### C. Column Count Validation
- **Minimum Columns**: 4 columns required
- **Purpose**: Prevents separator mismatch issues
- **Visual Indicator**: Separator dropdown highlighted in red
- **Suggestion**: Try changing separator setting

---

## 7. Error Prevention Benefits

### A. Data Quality Assurance
- **Prevents Invalid Imports**: Users cannot proceed with validation errors
- **Format Consistency**: Ensures all data matches selected formats
- **Separator Detection**: Helps identify CSV parsing issues
- **Visual Feedback**: Clear indication of validation problems

### B. User Experience Improvements
- **Clear Guidance**: Specific suggestions for fixing issues
- **Helpful Links**: Access to format help and CSV structure guides
- **Consistent UI**: Professional error handling across all states
- **Progressive Disclosure**: Errors shown at appropriate times

### C. System Reliability
- **Downstream Protection**: Prevents invalid data from reaching forecasting
- **Error Isolation**: Validation errors caught early in import process
- **Debugging Support**: Clear error messages for troubleshooting
- **Maintenance**: Standardized error handling reduces code complexity

---

## 8. "Gotchas" & Historical Context

- **Validation Markers**: The system uses "❌ Invalid (format)" markers in data to indicate validation errors. These markers are added by the backend and detected by the frontend for error highlighting.

- **Progression Blocking**: Users cannot proceed to the mapping step when validation errors exist. This prevents importing invalid data and ensures data quality.

- **Consistent Error Handling**: All error states use the same ErrorHandler component styling for consistency and professional appearance.

- **Format Validation**: Both date and number format validation are strict and require exact format matching. This prevents data corruption from format mismatches.

- **Column Count Validation**: The system requires at least 4 columns to prevent separator mismatch issues. This helps users identify and fix CSV parsing problems.

- **Visual Feedback**: Error highlighting uses red backgrounds and borders to clearly indicate validation issues in the preview table.

- **Helpful Links**: The system provides links to format help and CSV structure guides to assist users in fixing validation issues.

---

## 9. Future Enhancements

### A. Planned Features
- **Real-time Validation**: Validate formats as user types
- **Format Suggestions**: Suggest formats based on data analysis
- **Advanced Detection**: More sophisticated format auto-detection
- **Custom Validation**: User-defined validation rules

### B. Performance Improvements
- **Validation Caching**: Cache validation results for repeated checks
- **Batch Validation**: Validate multiple formats simultaneously
- **Progressive Validation**: Validate data in chunks for large files

### C. User Experience
- **Interactive Help**: Inline format help and examples
- **Validation History**: Track and display validation patterns
- **Format Templates**: Save and reuse format configurations
- **Collaborative Validation**: Support for team-based format validation

---

**For related documentation, see:**
- `Upload Wizard & Data Transformation.md` - Complete import workflow
- `Data Cleaning Methods & Implementation.md` - Data cleaning workflows
- `UI State Management & Data Flow.md` - State management patterns 