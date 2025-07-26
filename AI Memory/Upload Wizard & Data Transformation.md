# Upload Wizard & Data Transformation: A Technical Guide

*This document provides a technical breakdown of the CSV import process, including frontend and backend logic, AI-powered data transformation, deduplication, and the step-by-step workflow for importing and preparing data.*

## 1. Core Problem / Use Case

Users need to upload CSV files containing sales data and transform them into a standardized format for forecasting. The system must handle various CSV formats, detect data structure, validate formats, and provide both AI-powered and manual transformation options.

**Key Requirements:**
- Support multiple CSV separators (comma, semicolon, tab, pipe)
- Auto-detect date and number formats
- Validate data formats with user-friendly error messages
- Block progression when validation errors exist
- Provide both AI-powered and manual transformation workflows
- Handle large files with appropriate processing strategies
- Prevent duplicate imports with hash-based detection

---

## 2. How It Works: The Import Architecture

The system provides a comprehensive import solution with robust validation and error handling:

### A. Upload & Preview Flow

**Step 1: File Upload**
- User selects CSV file or drags and drops
- System detects file size and applies large file processing if needed
- Duplicate detection using SHA-256 hash comparison
- Auto-detection of separator, date format, and number format

**Step 2: Preview Generation**
- Backend processes CSV with detected/selected formats
- Returns preview data with validation markers for invalid formats
- Frontend displays preview table with error highlighting
- Validation errors block progression to mapping step

**Step 3: Format Validation**
- **Date Format Validation**: Checks if dates match selected format (dd/mm/yyyy, mm/dd/yyyy, etc.)
- **Number Format Validation**: Validates numbers against selected format (1,234.56, 1.234,56, etc.)
- **Column Count Validation**: Ensures sufficient columns (minimum 4) to prevent separator mismatch
- **Visual Error Indicators**: Invalid cells and headers highlighted in red
- **Progression Blocking**: "Next: Mapping" button disabled when validation errors exist

**Step 4: Error Handling**
- **Standardized ErrorHandler Component**: Consistent styling for all error states
- **Validation Warnings**: ErrorHandler-style warnings for format and column issues
- **Helpful Links**: Date format help, number format help, CSV structure guide
- **Suggestions**: Contextual suggestions for fixing validation issues

### B. AI-Powered Transformation

**AI Flow Selection**
- System checks if AI features are enabled and file size is appropriate
- Large files can be processed with AI if enabled in settings
- AI processing includes reasoning and transformation suggestions

**AI Processing Stages**
1. **Initialization**: Prepare file for AI processing
2. **Description**: AI analyzes file structure and content
3. **Transformation**: AI applies data transformation
4. **Preview**: Show AI-transformed data for user review
5. **Mapping**: AI-suggested column role mapping

**AI Error Handling**
- Graceful fallback to manual import on AI failure
- Custom error dialog with detailed error messages
- Automatic switching to manual workflow

### C. Manual Transformation

**Manual Flow**
- Direct preview of parsed CSV data
- User-controlled format selection and validation
- Manual column role mapping
- Real-time validation feedback

**Format Controls**
- **Separator Selection**: Comma, semicolon, tab, pipe with auto-detection
- **Date Format Selection**: Multiple format options with validation
- **Number Format Selection**: Various number format options with validation
- **Transpose Option**: Toggle between wide and long data formats

---

## 3. Key Code Pointers

| Area                     | File / Component                     | Key Function / Hook         | Purpose                                                      |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| **Main Wizard**          | `src/components/CsvImportWizard.tsx` | `CsvImportWizard`           | Orchestrates the entire import workflow                      |
| **Upload Step**          | `src/components/CsvImportWizard/UploadStep.tsx` | `UploadStep` | Handles file upload and drag-and-drop                        |
| **Preview Step**         | `src/components/CsvImportWizard/PreviewStep.tsx` | `PreviewStep` | Shows data preview with validation and error handling        |
| **Error Handler**        | `src/components/CsvImportWizard/ErrorHandler.tsx` | `ErrorHandler` | Standardized error display component                         |
| **Backend Preview**      | `src/backend/routes.js`              | `POST /api/generate-preview` | Generates preview data with validation markers               |
| **Format Validation**    | `src/utils/csvUtils.ts`              | `parseNumberWithFormat`     | Validates number formats with strict regex                   |
| **AI Transformation**    | `src/utils/aiDataTransform.ts`       | `transformDataWithAI`       | AI-powered data transformation                               |
| **Duplicate Detection**  | `src/backend/routes.js`              | `POST /api/check-csv-duplicate` | Prevents duplicate imports using hash comparison             |

---

## 4. Validation System

### A. Format Validation Logic

**Date Format Validation**
```javascript
// Backend validation in generate-preview endpoint
const parseDateWithFormat = (value, format) => {
  // Strict validation based on selected format
  // Returns null for invalid dates
  // Adds "❌ Invalid (format)" marker to invalid values
};
```

**Number Format Validation**
```javascript
// Enhanced validation with strict regex patterns
const parseNumberWithFormat = (value, format) => {
  // Validates thousands separators, decimal places
  // Checks for required format elements
  // Returns NaN for invalid numbers
  // Adds "❌ Invalid (format)" marker to invalid values
};
```

### B. Validation Error Detection

**Frontend Error Detection**
```javascript
const hasFormatErrors = () => {
  // Check for "❌ Invalid" markers in data and headers
  // Returns true if any validation errors found
};

const hasInsufficientColumns = () => {
  // Check if CSV has fewer than 4 columns
  // Indicates likely separator mismatch
};

const hasValidationErrors = () => {
  // Combines format and column validation
  // Used to block progression
};
```

### C. Visual Error Indicators

**Error Highlighting**
- **Invalid Headers**: Red background with red border
- **Invalid Cells**: Red background with left red border
- **Separator Dropdown**: Red border when insufficient columns
- **Validation Warning**: ErrorHandler-style warning banner

**Progression Control**
- **Disabled Button**: "Next: Mapping" button disabled when errors exist
- **Tooltip**: Explains why button is disabled
- **Visual Feedback**: Button appears grayed out

---

## 5. Error Handling System

### A. Standardized ErrorHandler Component

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
      {/* Dynamic title based on error type */}
    </div>
    <div className="text-slate-500 text-sm mb-4">
      {/* Dynamic message */}
    </div>
    {/* Suggestions and helpful links */}
  </div>
)}
```

**Consistent UX**
- Same visual style as ErrorHandler component
- Icon size, layout, typography consistency
- Suggestions and helpful links integration
- Professional appearance across all error states

---

## 6. Backend Integration

### A. Preview Generation Endpoint

**API**: `POST /api/generate-preview`
**Parameters**:
- `csvData`: Raw CSV content
- `separator`: CSV separator (auto-detected or user-selected)
- `dateFormat`: Date format for validation
- `numberFormat`: Number format for validation
- `transposed`: Whether data should be transposed

**Response**:
- `headers`: Column headers with validation markers
- `previewRows`: Preview data with validation markers
- `originalHeaders`: Original headers for data access
- `separator`: Detected/used separator
- `dateFormat`: Detected/used date format
- `numberFormat`: Detected/used number format
- `columnRoles`: Auto-detected column roles

### B. Validation Markers

**Format**: `❌ Invalid (format)` appended to invalid values
**Detection**: Frontend checks for these markers to identify errors
**Display**: Invalid values highlighted in red in preview table

### C. Duplicate Detection

**Hash Generation**: SHA-256 hash of CSV content
**Database Check**: Compare hash against existing datasets
**User Choice**: Load existing or upload anyway
**Prevention**: Avoids duplicate processing and storage

---

## 7. User Experience Flow

### A. Successful Import
1. **File Upload**: User selects or drags CSV file
2. **Auto-Detection**: System detects formats automatically
3. **Preview Display**: Shows data with validation results
4. **Format Adjustment**: User can adjust formats if needed
5. **Validation**: System validates all data formats
6. **Progression**: User proceeds to mapping step
7. **Transformation**: Data transformed to standard format
8. **Completion**: Dataset ready for forecasting

### B. Error Handling Flow
1. **Error Detection**: System identifies validation issues
2. **Visual Feedback**: Errors highlighted in preview table
3. **Warning Display**: ErrorHandler-style warning banner
4. **Progression Blocked**: "Next: Mapping" button disabled
5. **User Guidance**: Suggestions and helpful links provided
6. **Format Adjustment**: User fixes format issues
7. **Re-validation**: System re-validates after changes
8. **Progression**: User proceeds when errors resolved

### C. AI Processing Flow
1. **AI Selection**: System determines if AI processing is appropriate
2. **AI Analysis**: AI analyzes file structure and content
3. **Transformation**: AI applies data transformation
4. **Preview**: Shows AI-transformed data
5. **User Review**: User reviews AI suggestions
6. **Confirmation**: User confirms AI transformation
7. **Completion**: Dataset ready for forecasting

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
- **Advanced Format Detection**: More sophisticated format auto-detection
- **Batch Import**: Support for multiple file imports
- **Template System**: Save and reuse import configurations
- **Validation Rules**: Custom validation rules for specific data types

### B. Performance Improvements
- **Streaming Processing**: Handle very large files with streaming
- **Caching**: Cache validation results for repeated imports
- **Parallel Processing**: Process multiple files simultaneously

### C. User Experience
- **Real-time Validation**: Validate formats as user types
- **Format Suggestions**: Suggest formats based on data analysis
- **Import History**: Track and manage import history
- **Collaborative Import**: Support for team-based data imports

---

**For related documentation, see:**
- `Data Cleaning Methods & Implementation.md` - Data cleaning workflows
- `Queue Processing & Job Management.md` - Optimization triggering
- `UI State Management & Data Flow.md` - State management patterns 