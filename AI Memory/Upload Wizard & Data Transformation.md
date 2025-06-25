# Upload Wizard & Data Transformation: A Technical Guide

This document provides a detailed technical breakdown of the CSV import process, covering the frontend React components, the backend Node.js server, the AI-powered data transformation logic, and the deduplication/existing data detection flow.

## 1. Core Principles (Updated)

- **Single Parse, Single Source:** The CSV is parsed and cleaned ONCE during the preview step. All subsequent steps (mapping, normalization, backend upload) use this cleaned, user-confirmed data (wide format).
- **No Re-parsing:** The backend never re-parses the raw CSV. It receives only the cleaned, wide-format data and headers from the frontend.
- **Explicit Data Format:**
  - **Wide format** is used for storage, display, and backend upload.
  - **Long format** is only used for analysis components (outlier detection, forecasting) as needed.
- **WYSIWYG:** What the user sees in the preview is exactly what gets imported and stored.
- **Deduplication:** The raw CSV string is hashed (SHA-256, truncated to 30 hex chars) immediately after upload. This hash is used for duplicate detection on both frontend and backend, and is stored with each processed dataset.
- **Consistent Output:** Both AI and manual imports now produce identical JSON structure, including metadata (`summary`, `columnRoles`, `name`, `csvHash`).
- **Existing Data Detection:** On app load, the backend scans for processed JSONs and their hashes. The frontend presents these for selection, allowing users to skip upload if a match is found.
- **Loading Existing Data:** Loading an existing dataset skips the wizard and loads the data directly into the main workflow (Clean & Prepare step).

---

## 2. Updated Data Flow

| Step                | Frontend → Backend | Backend → Frontend | Format Used           |
|---------------------|-------------------|--------------------|-----------------------|
| Existing Data Check | Raw CSV           | Duplicate info     | Hash                  |
| Preview             | Raw CSV           | Cleaned preview    | Wide (for preview)    |
| Mapping             | Cleaned preview   | -                  | Wide                  |
| Confirm Import      | Cleaned wide      | -                  | Wide (for storage)    |
| Analysis            | Wide              | Long (if needed)   | Long (for analysis)   |

- **Deduplication:** After upload, the frontend hashes the raw CSV and checks with the backend for duplicates. If a match is found, the user can load the existing dataset instead of re-importing.
- **After preview:** All mapping, normalization, and backend upload use the cleaned, de-blanked, user-confirmed preview data (wide format).
- **Backend:** Accepts only cleaned data and headers, never the raw CSV (except for deduplication hash).
- **Long format:** Used only for outlier detection, forecasting, or charts that require it.

---

## 3. Troubleshooting Checklist (Updated)
- If you see "Invalid Date" or blank columns in the data, check that the backend is using the cleaned preview data, not re-parsing the raw CSV.
- If the preview and final import differ, ensure all steps use the previewed data.
- If deduplication is not working, ensure both frontend and backend are hashing the exact same raw CSV string (not a reconstructed version).

---

## 4. Gotchas & Lessons Learned
- Never re-parse or reconstruct the CSV from objects for deduplication—always use the raw uploaded string for hashing.
- Never re-parse the raw CSV after preview. Always use the cleaned, user-confirmed data for all further steps.
- Be explicit about when you're using wide vs. long format, and only transform when necessary.
- Always include all required metadata (`summary`, `columnRoles`, `name`, `csvHash`) in saved JSONs for detection and UI consistency.

---

## 5. Summary Table (Updated)

| Stage                     | Component/File                           | Key Function(s)                   | Critical Logic                                      |
| ------------------------- | ---------------------------------------- | --------------------------------- | --------------------------------------------------- |
| **Deduplication**         | `CsvImportWizard.tsx`, `server.js`       | `checkCsvDuplicate` endpoint, hash logic | Hashes raw CSV, checks for duplicates before import. |
| **State & Orchestration** | `CsvImportWizard.tsx`                    | `handleFileChange`, `handleAITransform`, `handleManualConfirm` | Manages state, ensures all steps use cleaned preview data. |
| **File Upload UI**        | `CsvImportWizard/UploadStep.tsx`         | -                                 | Renders the dropzone and "Continue with Existing Data" section. |
| **AI/Manual Choice UI**   | `CsvImportWizard/ChoiceStep.tsx`         | -                                 | Renders the two import path choices.                |
| **Data Preview UI**       | `CsvImportWizard/PreviewStep.tsx`        | -                                 | Renders the data preview table.                     |
| **Column Mapping UI**     | `CsvImportWizard/MapStep.tsx`            | -                                 | Renders the column mapping interface.               |
| **Backend Pivot**         | `server.js`                              | `pivotTable`                      | Date normalization, chronological sort, sparsity.   |
| **API Response**          | `server.js`                              | `/apply-config`, `/process-manual-import` | Returns `{ transformedData, columns }` using only cleaned data. |

---

## 6. Frontend Components

The wizard's frontend is architected as a main state container that renders different child components for each step of the process.

### A. Main Container: `CsvImportWizard.tsx`
This component is the brain of the wizard. It does not render much UI itself but is responsible for:
- **State Management**: Holding all key state variables (`file`, `originalCsv`, `aiStep`, `step`, `aiResult`, `aiResultColumns`, etc.).
- **Orchestration**: Rendering the correct child component based on the current `step` and `aiStep`.
- **Handler Functions**: Containing all the core logic for file handling (`handleFileChange`), AI interaction (`handleAITransform`, `handleConfigProcessing`), and manual import processing (`handleManualConfirm`).

### B. Child Step Components (`src/components/CsvImportWizard/`)
These are "dumb" components that primarily focus on rendering the UI for a specific step and calling handler functions passed down from the parent.
- **`UploadStep.tsx`**: Displays the file dropzone, "Continue with Existing Data" section with dataset cards, and handles the initial file selection.
- **`ChoiceStep.tsx`**: Presents the user with the "AI-Powered" vs. "Manual Import" options.
- **`PreviewStep.tsx`**: Renders the data preview table, either from the AI transformation or the manual controls (separator, transpose).
- **`MapStep.tsx`**: Shows the column mapping interface and the final normalized data preview before import.

---

## 7. Backend Server: `server.js`

The backend handles all data processing and communication with the Grok AI API.

### A. API Endpoints

- **`POST /api/grok-transform`**: Used for the small file workflow.
- **`POST /api/grok-generate-config`**: Used for the large file workflow (step 1).
- **`POST /api/apply-config`**: Used for the large file workflow (step 2).
- **`POST /api/check-csv-duplicate`**: Checks for existing datasets with the same CSV hash before import.
- **`GET /api/detect-existing-data`**: Returns a list of all processed datasets and their metadata for existing data detection.

### B. The `pivotTable` Function
This is the most complex and critical part of the backend transformation logic.
- **Purpose**: To transform data from a "long" format (one row per sale) to a "wide" format (one row per product, with dates as columns).
- **Sparsity**: It only creates columns for dates that **actually exist** in the dataset.
- **Chronological Sorting**: It performs a proper date-based sort on columns.

---

## 8. Troubleshooting Checklist

If the upload or transformation fails, check the following:
1.  **Is the parent `CsvImportWizard.tsx` passing the correct props to the active child step component?**
2.  **Is the frontend using `aiResultColumns` to render the table headers in `PreviewStep.tsx` or `MapStep.tsx`?**
3.  **Does the backend API response include the `columns` array?** Check the browser's network tab.
4.  **Are the backend logs for `pivotTable` showing correct sorting?**
5.  **Is the correct workflow (small vs. large file) being triggered in `CsvImportWizard.tsx`?**
6.  **Is deduplication working?** Ensure both frontend and backend are hashing the exact same raw CSV string, and that the hash is stored and checked consistently.

---

## Summary Table

| Stage                     | Component/File                           | Key Function(s)                   | Critical Logic                                      |
| ------------------------- | ---------------------------------------- | --------------------------------- | --------------------------------------------------- |
| **Deduplication**         | `CsvImportWizard.tsx`, `server.js`       | `checkCsvDuplicate` endpoint, hash logic | Hashes raw CSV, checks for duplicates before import. |
| **State & Orchestration** | `CsvImportWizard.tsx`                    | `handleFileChange`, `handleAITransform` | Manages state and renders the correct step component. |
| **File Upload UI**        | `CsvImportWizard/UploadStep.tsx`         | -                                 | Renders the dropzone and existing data selection.   |
| **AI/Manual Choice UI**   | `CsvImportWizard/ChoiceStep.tsx`         | -                                 | Renders the two import path choices.                |
| **Data Preview UI**       | `CsvImportWizard/PreviewStep.tsx`        | -                                 | Renders the data preview table.                     |
| **Column Mapping UI**     | `CsvImportWizard/MapStep.tsx`            | -                                 | Renders the column mapping interface.               |
| **Backend Pivot**         | `server.js`                              | `pivotTable`                      | Date normalization, chronological sort, sparsity.   |
| **API Response**          | `server.js`                              | `/apply-config` handler           | Returns `{ transformedData, columns }`.             | 