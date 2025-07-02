# Data Cleaning Methods & Implementation: A Technical Guide

*This document outlines the two primary methods for data cleaning in the application: CSV file import/export and individual data point editing within the app.*

## 1. Core Problem / Use Case

Data cleaning is a critical step in the forecasting workflow where users can identify and correct outliers, add notes, and ensure data quality. The application provides two complementary approaches to accommodate different user preferences and workflows:

1. **CSV Import/Export**: For bulk operations, batch processing, or sharing cleaning changes between datasets
2. **Individual Point Editing**: For precise, interactive corrections within the app interface

Both methods integrate with the backend persistence system and trigger appropriate optimizations for affected SKUs.

---

## 2. Method 1: CSV File Import/Export

### A. Export Process

**Purpose**: Export current cleaning state to a CSV file for backup, sharing, or batch processing.

**Implementation Flow**:
1. User clicks "Export Cleaning Data" button in `OutlierExportImport` component
2. `exportCleaningData()` function in `csvUtils.ts` processes the data
3. Creates a structured CSV with metadata headers and cleaning records
4. Downloads file with timestamp: `data_cleaning_export_YYYY-MM-DD-HH-MM.csv`

**CSV Structure**:
```csv
# Data Cleaning Export
# Exported: [timestamp]
# Threshold: [z-score threshold]
# Total Records: [count]
# SKUs: [count]

Material Code,Date,Original_Sales,Cleaned_Sales,Change_Amount,Note,Was_Outlier,Z_Score
95000000,2022-01-01,90,85,-5,Outlier correction,Yes,2.5
```

**Key Code Points**:
- **Export Trigger**: `OutlierDetection.tsx` → `handleExportCleaning()` → `exportCleaningData()`
- **Data Processing**: `csvUtils.ts` → `exportCleaningData()` function
- **File Generation**: Creates `CleaningRecord[]` with metadata and statistics

### B. Import Process

**Purpose**: Import previously exported cleaning data or apply bulk corrections.

**Implementation Flow**:
1. User clicks "Import Cleaning Data" button
2. File input triggers `handleImportFile()` in `OutlierDetection.tsx`
3. `parseCleaningCSV()` validates and parses the CSV file
4. `ImportPreviewDialog` shows preview of changes with validation
5. User confirms import → `handleConfirmImport()` applies changes
6. Changes saved to backend via `/api/save-cleaned-data`
7. Affected SKUs queued for re-optimization

**Validation & Safety**:
- Validates SKU exists in current dataset
- Validates date exists for each SKU
- Shows preview before applying changes
- Handles CSV parsing errors gracefully
- Preserves original data structure

**Key Code Points**:
- **Import Trigger**: `OutlierDetection.tsx` → `handleImportFile()`
- **CSV Parsing**: `csvUtils.ts` → `parseCleaningCSV()`
- **Preview Dialog**: `ImportPreviewDialog.tsx`
- **Change Application**: `csvUtils.ts` → `applyImportChanges()`
- **Backend Save**: `handleConfirmImport()` → `/api/save-cleaned-data`

---

## 3. Method 2: Individual Data Point Editing

### A. Interactive Editing Interface

**Purpose**: Edit individual data points directly within the app for precise corrections.

**Implementation Flow**:
1. User clicks on outlier point in chart or data table
2. `handleDateClick()` highlights the date and scrolls to data point
3. `handleEditOutlier()` opens inline editing mode
4. User modifies sales value and/or adds note
5. `handleSaveEdit()` saves changes and triggers backend persistence
6. Affected SKU queued for re-optimization

**UI Components**:
- **Chart Interaction**: Click outlier points to highlight and edit
- **Inline Editing**: Direct value editing in data table
- **Note System**: Optional text notes for each correction
- **Visual Feedback**: Highlighted dates, editing indicators

**Key Code Points**:
- **Chart Interaction**: `OutlierDetection.tsx` → `handleDateClick()`
- **Edit Mode**: `handleEditOutlier()` → `editingOutliers` state
- **Save Changes**: `handleSaveEdit()` → backend persistence
- **UI State**: `highlightedDate`, `editingOutliers` state management

### B. Fullscreen Data Clean Modal (Recently Implemented)

**Purpose**: Provide a comprehensive, fullscreen interface for data cleaning that combines chart visualization and table editing in one seamless experience.

**Implementation Flow**:
1. User clicks "Open Fullscreen Editor" button in the main Clean & Prepare interface
2. `DataCleanModal` opens with fullscreen display using Radix Dialog
3. Modal displays the same chart as main view but fills all available space
4. Edit table appears below chart with improved layout and styling
5. All controls (SKU selector, z-score selector, navigation) are globalized
6. User can edit data points directly in the table with keyboard shortcuts
7. Changes are immediately reflected in both modal and main app

**Key Features**:
- **Fullscreen Display**: Modal uses custom CSS to achieve true fullscreen
- **Responsive Chart**: Chart fills all available vertical space above edit table
- **Globalized Controls**: SKU selector, z-score selector, and navigation buttons sync between modal and main app
- **Enhanced Table**: Improved input styling with blue borders, better proportions (20% value, 80% note)
- **Keyboard Shortcuts**: Enter to save (except Shift+Enter in textarea for new lines)
- **Auto-Selection**: Automatically selects data point with largest outlier z-score when switching SKUs
- **Consistent Data**: Uses same chart data logic as main view with proper fallback for original/cleaned series

**Technical Implementation**:
- **Modal Component**: `DataCleanModal.tsx` with Radix Dialog integration
- **Chart Integration**: Uses `OutlierChart` component with full height styling
- **State Management**: Globalized state ensures seamless synchronization
- **Chart Data Logic**: Builds single array with both `originalSales` and `cleanedSales` fields
- **Fallback Logic**: `cleanedData.length > 0 ? cleanedData : originalData` for consistent display
- **CSS Customization**: Custom styles for fullscreen display and responsive layout

**UI/UX Enhancements**:
- **Modern Styling**: Blue borders on inputs, proper spacing and alignment
- **Professional Layout**: Clean separation between chart and edit table
- **Improved Accessibility**: Better contrast, keyboard navigation, and visual feedback
- **Seamless Integration**: Modal doesn't close on save, maintains state consistency

**Key Code Points**:
- **Modal Trigger**: `OutlierDetection.tsx` → "Open Fullscreen Editor" button
- **Modal Component**: `DataCleanModal.tsx` with fullscreen implementation
- **Chart Integration**: Uses existing `OutlierChart` with responsive styling
- **State Globalization**: SKU selector, z-score selector, and navigation controls
- **Save Logic**: Same backend persistence as main interface
- **Keyboard Handling**: Enter key handling for save functionality

### C. Data Persistence

**Backend Integration**:
- All cleaning changes saved via `/api/save-cleaned-data`
- Returns new `filePath` for updated dataset
- Maintains cleaning history and metadata
- Integrates with new naming convention: `<BaseName>-<ShortHash>-cleaning.json`

**Optimization Triggering**:
- Individual edits: Single SKU re-optimization
- CSV imports: Multiple SKU re-optimization
- Both methods queue appropriate optimization jobs

### D. Backend Integration

**API Endpoints**:
- `POST /api/save-cleaned-data`: Save cleaning changes
- `GET /api/load-cleaned-data`: Load existing cleaning data (planned)

**File Naming Convention**:
- Cleaning files: `<BaseName>-<ShortHash>-cleaning.json`
- Discarded files: `<BaseName>-<ShortHash>-cleaning-discarded.json`

**Critical Implementation Detail**:
- The `/save-cleaned-data` endpoint saves cleaning data to `...-cleaning.json` files
- However, it **returns the processed file path** (`...-processed.json`) to the frontend
- This ensures `processedDataInfo.filePath` always points to a processed file, which is what the frontend expects
- This prevents the "Could not extract baseName and hash from filePath" error that occurs when the frontend receives a cleaning file path

**File Naming Convention**:
All dataset-related files follow the consistent naming pattern:
```
<BaseName>-<ShortHash>-<Type>.<ext>
```

Where:
- **BaseName**: `Original_CSV_Upload-<timestamp>` (e.g., `Original_CSV_Upload-1750860588846`)
- **ShortHash**: First 8 characters of the SHA-256 hash (e.g., `ce0391f8`)
- **Type**: `original`, `processed`, `cleaning`, or `discarded` (as suffix)
- **Extension**: `.csv` for original files, `.json` for processed/cleaning files

**Examples**:
- Original CSV: `Original_CSV_Upload-1750860588846-ce0391f8-original.csv`
- Processed data: `Original_CSV_Upload-1750860588846-ce0391f8-processed.json`
- Cleaning data: `Original_CSV_Upload-1750860588846-ce0391f8-cleaning.json`
- Discarded file: `Original_CSV_Upload-1750860588846-ce0391f8-cleaning-discarded.json`

This convention ensures:
- Consistent file organization
- Easy hash-based duplicate detection
- Clear file type identification
- Proper state management in the frontend

---

## 4. Technical Implementation Details

### A. Data Structures

**CleaningRecord Interface** (`csvUtils.ts`):
```typescript
interface CleaningRecord {
  sku: string;
  date: string;
  originalSales: number;
  cleanedSales: number;
  changeAmount: number;
  note?: string;
  wasOutlier: boolean;
  zScore: number;
}
```

**ImportPreview Interface** (`csvUtils.ts`):
```typescript
interface ImportPreview {
  sku: string;
  date: string;
  currentSales: number;
  newSales: number;
  changeAmount: number;
  note?: string;
  action: 'modify' | 'add_note' | 'no_change';
}
```

### B. State Management

**Key State Variables** (`OutlierDetection.tsx`):
- `cleanedData`: Current cleaned dataset
- `editingOutliers`: Currently editing data points
- `highlightedDate`: Date highlighted in chart
- `importPreviews`: Preview data for CSV imports
- `importErrors`: Validation errors for imports

**Globalized State** (Modal Integration):
- SKU selector state syncs between modal and main app
- Z-score selector state syncs between modal and main app
- Navigation controls maintain consistency across views
- Chart data uses same fallback logic in both contexts

### C. Backend Integration

**API Endpoints**:
- `POST /api/save-cleaned-data`: Save cleaning changes
- `GET /api/load-cleaned-data`: Load existing cleaning data (planned)

**File Naming Convention**:
- Cleaning files: `<BaseName>-<ShortHash>-cleaning.json`
- Discarded files: `<BaseName>-<ShortHash>-cleaning-discarded.json`

---

## 5. Key Code Pointers

| Area                     | File / Component                     | Key Function / Hook         | Purpose                                                      |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| **Export UI**            | `OutlierExportImport.tsx`            | `onExport` prop             | Triggers CSV export functionality                            |
| **Import UI**            | `OutlierDetection.tsx`               | `handleImportFile()`        | Handles CSV file upload and parsing                          |
| **CSV Processing**       | `csvUtils.ts`                        | `exportCleaningData()`      | Creates structured CSV export                                |
| **CSV Parsing**          | `csvUtils.ts`                        | `parseCleaningCSV()`        | Validates and parses import CSV                              |
| **Preview Dialog**       | `ImportPreviewDialog.tsx`            | -                           | Shows import preview with validation                         |
| **Individual Editing**   | `OutlierDetection.tsx`               | `handleEditOutlier()`       | Opens inline editing mode                                    |
| **Save Changes**         | `OutlierDetection.tsx`               | `handleSaveEdit()`          | Saves individual edits to backend                            |
| **Backend Save**         | `OutlierDetection.tsx`               | `handleConfirmImport()`     | Saves bulk changes to backend                                |
| **Optimization Trigger** | `OutlierDetection.tsx`               | `onImportDataCleaning()`    | Queues re-optimization for affected SKUs                     |
| **Fullscreen Modal**     | `DataCleanModal.tsx`                 | -                           | Provides comprehensive data cleaning interface                |
| **Modal Chart**          | `DataCleanModal.tsx`                 | Chart integration           | Displays responsive chart with full height                   |
| **Globalized Controls**  | `DataCleanModal.tsx`                 | State synchronization       | Maintains consistency between modal and main app             |
| **Keyboard Shortcuts**   | `DataCleanModal.tsx`                 | Enter key handling          | Provides keyboard-based save functionality                    |

---

## 6. "Gotchas" & Historical Context

- **Data Consistency**: Both methods work on the same underlying data structure. Individual edits are immediately reflected in the cleaned dataset, and CSV imports apply changes to the current state.

- **Optimization Scope**: Individual edits trigger single-SKU optimization, while CSV imports can trigger multi-SKU optimization depending on the imported changes.

- **Backend Persistence**: All cleaning changes are saved to the backend using the new naming convention, ensuring data persistence and multi-tenancy support.

- **Validation Safety**: CSV imports include comprehensive validation to prevent data corruption, including SKU existence checks and date validation.

- **UI State Management**: The editing interface uses complex state management (`editingOutliers`, `highlightedDate`) to provide smooth user experience during individual point editing.

- **Chart Data Logic**: Both the main Clean & Prepare chart and the fullscreen modal use the same fallback logic for displaying original vs. cleaned series. This ensures consistency across all views and prevents the chart from disappearing when switching between contexts.

- **Modal State Synchronization**: The fullscreen modal uses globalized state for controls (SKU selector, z-score selector, navigation) to ensure seamless synchronization between modal and main app. Changes in the modal immediately update the main app and vice versa.

- **Responsive Chart Display**: The modal chart is designed to fill all available vertical space above the edit table, providing maximum visibility while maintaining usability.

---

## 7. Future Enhancements

- **Cleaning History**: Track all cleaning operations with timestamps and user information
- **Undo/Redo**: Support for reverting cleaning changes
- **Bulk Operations**: Enhanced bulk editing capabilities within the app
- **Cleaning Templates**: Predefined cleaning patterns for common scenarios
- **Collaborative Cleaning**: Support for multiple users working on the same dataset
- **Mobile Responsiveness**: Optimize the fullscreen modal and data cleaning interface for mobile devices

---

## Global CSV Separator Setting (2024-06)

A global CSV separator setting was added to ensure consistent parsing and export of CSV files across the application. Supported options: comma, semicolon, tab, and pipe. This setting is stored in the backend database and is visible/editable in the main settings UI. 

- **Import:** The backend auto-detects the separator for each uploaded file, but the user can override it in the import wizard. The detected/selected separator is used for preview and processing.
- **Export:** The selected global separator is always used for CSV export.
- **Sync:** The frontend and backend keep the separator setting in sync, and changes are persisted.
- **Testing:** Scripts and UI tests verify correct separator handling for all supported types.

**For related documentation, see:**
- `Upload Wizard & Data Transformation.md` - Data import workflow
- `Queue Processing & Job Management.md` - Optimization triggering
- `UI State Management & Data Flow.md` - State management patterns 