# Dataset and SKU Filtering Implementation: Technical Guide

*This document outlines the comprehensive implementation of dataset and SKU filtering to ensure users only see results for the currently loaded dataset and selected SKU.*

## 1. Core Problem / Use Case

Users were seeing optimization results from all datasets and all SKUs, even when working with a specific dataset and SKU. This created confusion and made it difficult to focus on the relevant data. The system needed to implement comprehensive filtering at both the backend and frontend levels to ensure users only see results for:

1. **Currently Loaded Dataset**: Results should be filtered to only show data from the dataset currently loaded in the application
2. **Currently Selected SKU**: Results should be filtered to only show data for the SKU currently selected by the user

This filtering needed to be implemented across all relevant components:
- Optimization results display
- Export functionality
- Best results mapping
- Job monitoring

---

## 2. Implementation Overview

### A. Backend API Enhancements

**Dataset Filtering**:
- Enhanced `/api/jobs/best-results-per-model` endpoint to accept `filePath` parameter
- Enhanced `/api/jobs/export-results` endpoint to accept `filePath` parameter
- Backend database queries now filter by `filePath` to return only results for the specified dataset

**SKU Filtering**:
- Enhanced `/api/jobs/best-results-per-model` endpoint to accept `sku` parameter
- Enhanced `/api/jobs/export-results` endpoint to accept `sku` parameter
- Backend database queries now filter by `sku` to return only results for the specified SKU

### B. Frontend Filtering Logic

**Dataset Filtering**:
- `useBestResultsMapping` hook now passes `filePath` from `processedDataInfo` to backend API
- Export components pass `currentDataset.filePath` to backend API
- Results are filtered at the API level for better performance

**SKU Filtering**:
- `useBestResultsMapping` hook now passes `selectedSKU` to backend API
- Additional frontend filtering ensures only results for the selected SKU are displayed
- Export components support SKU-specific filtering with UI toggle

### C. Export System Integration

**Dataset-Specific Export**:
- Added dataset-specific toggle in export UI (enabled by default)
- Visual badges show "Dataset-Specific" when filtering is active
- Export API calls include `filePath` parameter when toggle is enabled

**SKU-Specific Export**:
- Added SKU-specific toggle in export UI
- Visual badges show "SKU-Specific" when filtering is active
- Export API calls include `sku` parameter when toggle is enabled

---

## 3. Technical Implementation Details

### A. Backend API Changes

**Best Results Endpoint** (`/api/jobs/best-results-per-model`):
```javascript
// Accept filePath and sku parameters
const { method, filePath, sku } = req.query;

// Add dataset filtering to database query
if (filePath) {
    query += ` AND filePath = ?`;
    params.push(filePath);
}

// Add SKU filtering to database query
if (sku) {
    query += ` AND sku = ?`;
    params.push(sku);
}
```

**Export Endpoint** (`/api/jobs/export-results`):
```javascript
// Accept filePath and sku parameters
const { method, format = 'csv', filePath, sku } = req.query;

// Apply same filtering logic as best results endpoint
if (filePath) {
    query += ` AND filePath = ?`;
    params.push(filePath);
}

if (sku) {
    query += ` AND sku = ?`;
    params.push(sku);
}
```

### B. Frontend Hook Changes

**useBestResultsMapping Hook**:
```typescript
// Pass filePath and selectedSKU to backend API
const params = new URLSearchParams({
    mapeWeight: mapeWeight.toString(),
    rmseWeight: rmseWeight.toString(),
    maeWeight: maeWeight.toString(),
    accuracyWeight: accuracyWeight.toString(),
});

if (filePath) {
    params.append('filePath', filePath);
}

if (selectedSKU) {
    params.append('sku', selectedSKU);
}

// Additional frontend filtering for SKU
const filteredResults = data.bestResultsPerModelMethod.filter(result => {
    return result.methods.some(method => 
        method.bestResult && method.bestResult.sku === selectedSKU
    );
});
```

### C. Export Component Changes

**OptimizationResultsExporter Component**:
```typescript
// Add selectedSKU prop and skuSpecific state
interface OptimizationResultsExporterProps {
    currentDataset?: { filePath?: string; filename?: string; name?: string; } | null;
    selectedSKU?: string | null;
}

// Add SKU filtering to export API call
if (skuSpecific && selectedSKU) {
    params.append('sku', selectedSKU);
}

// Add SKU-specific toggle UI
<div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
    <Package className="h-4 w-4 text-green-600" />
    <div className="flex-1">
        <div className="flex items-center space-x-2">
            <Switch
                id="sku-specific"
                checked={skuSpecific}
                onCheckedChange={setSkuSpecific}
                disabled={isExporting !== null}
            />
            <Label htmlFor="sku-specific" className="text-sm font-medium">
                Export SKU-specific results only
            </Label>
        </div>
        <p className="text-xs text-gray-600 mt-1">
            Filter results to only include the currently selected SKU: {selectedSKU}
        </p>
    </div>
</div>
```

### D. Component Prop Updates

**MainLayout Component**:
```typescript
// Pass selectedSKU to child components
<OptimizationQueuePopup
    // ... other props
    selectedSKU={selectedSKU}
/>

<FloatingSettingsButton
    // ... other props
    selectedSKU={selectedSKU}
/>
```

---

## 4. Key Code Pointers

| Area                     | File / Component                     | Key Function / Hook         | Purpose                                                      |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| **Backend API**          | `src/backend/routes.js`              | `/api/jobs/best-results-per-model` | Enhanced to accept filePath and sku parameters              |
| **Backend API**          | `src/backend/routes.js`              | `/api/jobs/export-results`  | Enhanced to accept filePath and sku parameters              |
| **Frontend Hook**        | `src/hooks/useBestResultsMapping.ts` | `fetchBestResults`          | Passes filePath and selectedSKU to backend API              |
| **Export Component**     | `src/components/OptimizationResultsExporter.tsx` | Export logic | Implements dataset and SKU filtering with UI toggles        |
| **Main Layout**          | `src/components/MainLayout.tsx`      | Component props             | Passes selectedSKU to child components                       |
| **Queue Popup**          | `src/components/OptimizationQueuePopup.tsx` | Props interface | Receives and passes selectedSKU to export component         |
| **Settings Button**      | `src/components/FloatingSettingsButton.tsx` | Props interface | Receives and passes selectedSKU to export component         |

---

## 5. User Experience Flow

### A. Dataset Filtering
1. **User loads a dataset** → `processedDataInfo.filePath` is set
2. **Optimization results display** → Only shows results for the loaded dataset
3. **Export functionality** → Dataset-specific toggle is enabled by default
4. **Visual feedback** → "Dataset-Specific" badge appears when filtering is active

### B. SKU Filtering
1. **User selects a SKU** → `selectedSKU` state is updated
2. **Optimization results display** → Only shows results for the selected SKU
3. **Export functionality** → SKU-specific toggle available for additional filtering
4. **Visual feedback** → "SKU-Specific" badge appears when filtering is active

### C. Combined Filtering
1. **Both filters active** → Results show only data for the specific dataset and SKU
2. **Export with both filters** → CSV contains only the most relevant data
3. **Performance benefits** → Reduced data transfer and processing time

---

## 6. Performance Benefits

### A. Backend Performance
- **Reduced Database Queries**: Filtering at the database level reduces data transfer
- **Faster Response Times**: Smaller result sets are processed and returned faster
- **Lower Memory Usage**: Backend processes only relevant data

### B. Frontend Performance
- **Reduced Network Traffic**: Smaller API responses reduce bandwidth usage
- **Faster UI Updates**: Less data to process and render in the frontend
- **Better User Experience**: Users see relevant results immediately

### C. Export Performance
- **Smaller Export Files**: Filtered exports contain only relevant data
- **Faster Export Generation**: Less data to process for CSV generation
- **Reduced Storage**: Smaller files are easier to store and share

---

## 7. "Gotchas" & Historical Context

### A. Implementation Discoveries
- **Backend-Frontend Sync**: Initially, only backend filtering was implemented, but frontend filtering was also needed for complete SKU isolation
- **Export Integration**: The export system needed to be updated to support both dataset and SKU filtering with user-friendly toggles
- **Component Props**: All components in the chain needed to be updated to pass the `selectedSKU` prop correctly

### B. Data Flow Considerations
- **Single Source of Truth**: The filtering follows the established pattern where page-level components manage state and pass it down as props
- **Real-time Updates**: Filtering updates immediately when users switch datasets or SKUs
- **State Persistence**: Filtering state is maintained across navigation and component re-renders

### C. Backward Compatibility
- **Optional Parameters**: All filtering parameters are optional, ensuring existing functionality continues to work
- **Default Behavior**: Dataset-specific filtering is enabled by default for better user experience
- **Graceful Degradation**: If filtering parameters are missing, the system falls back to showing all results

---

## 8. Future Enhancements

### A. Advanced Filtering
- **Date Range Filtering**: Allow users to filter results by date ranges
- **Model Type Filtering**: Filter results by specific model types or categories
- **Performance Metric Filtering**: Filter by minimum/maximum performance thresholds

### B. Filtering UI Improvements
- **Filter Presets**: Save and restore common filtering combinations
- **Filter History**: Track and display recently used filter combinations
- **Bulk Operations**: Apply filtering to multiple datasets or SKUs simultaneously

### C. Performance Optimizations
- **Caching**: Cache filtered results to avoid repeated API calls
- **Lazy Loading**: Load filtered results on-demand rather than all at once
- **Pagination**: Implement pagination for large filtered result sets

---

## 9. Testing and Validation

### A. Manual Testing
- **Dataset Switching**: Verify that switching datasets shows only relevant results
- **SKU Selection**: Verify that selecting different SKUs shows only relevant results
- **Export Functionality**: Verify that filtered exports contain only expected data
- **UI State**: Verify that filtering toggles and badges update correctly

### B. Edge Cases
- **No Data**: Verify graceful handling when no data matches the filters
- **Invalid Parameters**: Verify graceful handling of invalid filePath or SKU values
- **Missing Parameters**: Verify fallback behavior when filtering parameters are missing

### C. Performance Testing
- **Large Datasets**: Verify filtering performance with large datasets
- **Multiple SKUs**: Verify filtering performance with many SKUs
- **Concurrent Users**: Verify filtering performance under load

---

**For related documentation, see:**
- `UI State Management & Data Flow.md` - Single source of truth pattern
- `Optimization Results Export System.md` - Export system integration
- `Development Plans & Roadmap.md` - Implementation planning and status 

*This document outlines the comprehensive implementation of dataset and SKU filtering to ensure users only see results for the currently loaded dataset and selected SKU.*

## 1. Core Problem / Use Case

Users were seeing optimization results from all datasets and all SKUs, even when working with a specific dataset and SKU. This created confusion and made it difficult to focus on the relevant data. The system needed to implement comprehensive filtering at both the backend and frontend levels to ensure users only see results for:

1. **Currently Loaded Dataset**: Results should be filtered to only show data from the dataset currently loaded in the application
2. **Currently Selected SKU**: Results should be filtered to only show data for the SKU currently selected by the user

This filtering needed to be implemented across all relevant components:
- Optimization results display
- Export functionality
- Best results mapping
- Job monitoring

---

## 2. Implementation Overview

### A. Backend API Enhancements

**Dataset Filtering**:
- Enhanced `/api/jobs/best-results-per-model` endpoint to accept `filePath` parameter
- Enhanced `/api/jobs/export-results` endpoint to accept `filePath` parameter
- Backend database queries now filter by `filePath` to return only results for the specified dataset

**SKU Filtering**:
- Enhanced `/api/jobs/best-results-per-model` endpoint to accept `sku` parameter
- Enhanced `/api/jobs/export-results` endpoint to accept `sku` parameter
- Backend database queries now filter by `sku` to return only results for the specified SKU

### B. Frontend Filtering Logic

**Dataset Filtering**:
- `useBestResultsMapping` hook now passes `filePath` from `processedDataInfo` to backend API
- Export components pass `currentDataset.filePath` to backend API
- Results are filtered at the API level for better performance

**SKU Filtering**:
- `useBestResultsMapping` hook now passes `selectedSKU` to backend API
- Additional frontend filtering ensures only results for the selected SKU are displayed
- Export components support SKU-specific filtering with UI toggle

### C. Export System Integration

**Dataset-Specific Export**:
- Added dataset-specific toggle in export UI (enabled by default)
- Visual badges show "Dataset-Specific" when filtering is active
- Export API calls include `filePath` parameter when toggle is enabled

**SKU-Specific Export**:
- Added SKU-specific toggle in export UI
- Visual badges show "SKU-Specific" when filtering is active
- Export API calls include `sku` parameter when toggle is enabled

---

## 3. Technical Implementation Details

### A. Backend API Changes

**Best Results Endpoint** (`/api/jobs/best-results-per-model`):
```javascript
// Accept filePath and sku parameters
const { method, filePath, sku } = req.query;

// Add dataset filtering to database query
if (filePath) {
    query += ` AND filePath = ?`;
    params.push(filePath);
}

// Add SKU filtering to database query
if (sku) {
    query += ` AND sku = ?`;
    params.push(sku);
}
```

**Export Endpoint** (`/api/jobs/export-results`):
```javascript
// Accept filePath and sku parameters
const { method, format = 'csv', filePath, sku } = req.query;

// Apply same filtering logic as best results endpoint
if (filePath) {
    query += ` AND filePath = ?`;
    params.push(filePath);
}

if (sku) {
    query += ` AND sku = ?`;
    params.push(sku);
}
```

### B. Frontend Hook Changes

**useBestResultsMapping Hook**:
```typescript
// Pass filePath and selectedSKU to backend API
const params = new URLSearchParams({
    mapeWeight: mapeWeight.toString(),
    rmseWeight: rmseWeight.toString(),
    maeWeight: maeWeight.toString(),
    accuracyWeight: accuracyWeight.toString(),
});

if (filePath) {
    params.append('filePath', filePath);
}

if (selectedSKU) {
    params.append('sku', selectedSKU);
}

// Additional frontend filtering for SKU
const filteredResults = data.bestResultsPerModelMethod.filter(result => {
    return result.methods.some(method => 
        method.bestResult && method.bestResult.sku === selectedSKU
    );
});
```

### C. Export Component Changes

**OptimizationResultsExporter Component**:
```typescript
// Add selectedSKU prop and skuSpecific state
interface OptimizationResultsExporterProps {
    currentDataset?: { filePath?: string; filename?: string; name?: string; } | null;
    selectedSKU?: string | null;
}

// Add SKU filtering to export API call
if (skuSpecific && selectedSKU) {
    params.append('sku', selectedSKU);
}

// Add SKU-specific toggle UI
<div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
    <Package className="h-4 w-4 text-green-600" />
    <div className="flex-1">
        <div className="flex items-center space-x-2">
            <Switch
                id="sku-specific"
                checked={skuSpecific}
                onCheckedChange={setSkuSpecific}
                disabled={isExporting !== null}
            />
            <Label htmlFor="sku-specific" className="text-sm font-medium">
                Export SKU-specific results only
            </Label>
        </div>
        <p className="text-xs text-gray-600 mt-1">
            Filter results to only include the currently selected SKU: {selectedSKU}
        </p>
    </div>
</div>
```

### D. Component Prop Updates

**MainLayout Component**:
```typescript
// Pass selectedSKU to child components
<OptimizationQueuePopup
    // ... other props
    selectedSKU={selectedSKU}
/>

<FloatingSettingsButton
    // ... other props
    selectedSKU={selectedSKU}
/>
```

---

## 4. Key Code Pointers

| Area                     | File / Component                     | Key Function / Hook         | Purpose                                                      |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| **Backend API**          | `src/backend/routes.js`              | `/api/jobs/best-results-per-model` | Enhanced to accept filePath and sku parameters              |
| **Backend API**          | `src/backend/routes.js`              | `/api/jobs/export-results`  | Enhanced to accept filePath and sku parameters              |
| **Frontend Hook**        | `src/hooks/useBestResultsMapping.ts` | `fetchBestResults`          | Passes filePath and selectedSKU to backend API              |
| **Export Component**     | `src/components/OptimizationResultsExporter.tsx` | Export logic | Implements dataset and SKU filtering with UI toggles        |
| **Main Layout**          | `src/components/MainLayout.tsx`      | Component props             | Passes selectedSKU to child components                       |
| **Queue Popup**          | `src/components/OptimizationQueuePopup.tsx` | Props interface | Receives and passes selectedSKU to export component         |
| **Settings Button**      | `src/components/FloatingSettingsButton.tsx` | Props interface | Receives and passes selectedSKU to export component         |

---

## 5. User Experience Flow

### A. Dataset Filtering
1. **User loads a dataset** → `processedDataInfo.filePath` is set
2. **Optimization results display** → Only shows results for the loaded dataset
3. **Export functionality** → Dataset-specific toggle is enabled by default
4. **Visual feedback** → "Dataset-Specific" badge appears when filtering is active

### B. SKU Filtering
1. **User selects a SKU** → `selectedSKU` state is updated
2. **Optimization results display** → Only shows results for the selected SKU
3. **Export functionality** → SKU-specific toggle available for additional filtering
4. **Visual feedback** → "SKU-Specific" badge appears when filtering is active

### C. Combined Filtering
1. **Both filters active** → Results show only data for the specific dataset and SKU
2. **Export with both filters** → CSV contains only the most relevant data
3. **Performance benefits** → Reduced data transfer and processing time

---

## 6. Performance Benefits

### A. Backend Performance
- **Reduced Database Queries**: Filtering at the database level reduces data transfer
- **Faster Response Times**: Smaller result sets are processed and returned faster
- **Lower Memory Usage**: Backend processes only relevant data

### B. Frontend Performance
- **Reduced Network Traffic**: Smaller API responses reduce bandwidth usage
- **Faster UI Updates**: Less data to process and render in the frontend
- **Better User Experience**: Users see relevant results immediately

### C. Export Performance
- **Smaller Export Files**: Filtered exports contain only relevant data
- **Faster Export Generation**: Less data to process for CSV generation
- **Reduced Storage**: Smaller files are easier to store and share

---

## 7. "Gotchas" & Historical Context

### A. Implementation Discoveries
- **Backend-Frontend Sync**: Initially, only backend filtering was implemented, but frontend filtering was also needed for complete SKU isolation
- **Export Integration**: The export system needed to be updated to support both dataset and SKU filtering with user-friendly toggles
- **Component Props**: All components in the chain needed to be updated to pass the `selectedSKU` prop correctly

### B. Data Flow Considerations
- **Single Source of Truth**: The filtering follows the established pattern where page-level components manage state and pass it down as props
- **Real-time Updates**: Filtering updates immediately when users switch datasets or SKUs
- **State Persistence**: Filtering state is maintained across navigation and component re-renders

### C. Backward Compatibility
- **Optional Parameters**: All filtering parameters are optional, ensuring existing functionality continues to work
- **Default Behavior**: Dataset-specific filtering is enabled by default for better user experience
- **Graceful Degradation**: If filtering parameters are missing, the system falls back to showing all results

---

## 8. Future Enhancements

### A. Advanced Filtering
- **Date Range Filtering**: Allow users to filter results by date ranges
- **Model Type Filtering**: Filter results by specific model types or categories
- **Performance Metric Filtering**: Filter by minimum/maximum performance thresholds

### B. Filtering UI Improvements
- **Filter Presets**: Save and restore common filtering combinations
- **Filter History**: Track and display recently used filter combinations
- **Bulk Operations**: Apply filtering to multiple datasets or SKUs simultaneously

### C. Performance Optimizations
- **Caching**: Cache filtered results to avoid repeated API calls
- **Lazy Loading**: Load filtered results on-demand rather than all at once
- **Pagination**: Implement pagination for large filtered result sets

---

## 9. Testing and Validation

### A. Manual Testing
- **Dataset Switching**: Verify that switching datasets shows only relevant results
- **SKU Selection**: Verify that selecting different SKUs shows only relevant results
- **Export Functionality**: Verify that filtered exports contain only expected data
- **UI State**: Verify that filtering toggles and badges update correctly

### B. Edge Cases
- **No Data**: Verify graceful handling when no data matches the filters
- **Invalid Parameters**: Verify graceful handling of invalid filePath or SKU values
- **Missing Parameters**: Verify fallback behavior when filtering parameters are missing

### C. Performance Testing
- **Large Datasets**: Verify filtering performance with large datasets
- **Multiple SKUs**: Verify filtering performance with many SKUs
- **Concurrent Users**: Verify filtering performance under load

---

**For related documentation, see:**
- `UI State Management & Data Flow.md` - Single source of truth pattern
- `Optimization Results Export System.md` - Export system integration
- `Development Plans & Roadmap.md` - Implementation planning and status 