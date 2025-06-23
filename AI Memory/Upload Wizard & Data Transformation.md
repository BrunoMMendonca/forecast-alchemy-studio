# Upload Wizard & Data Transformation: A Technical Guide

This document provides a detailed technical breakdown of the CSV import process, covering the frontend React components, the backend Node.js server, and the AI-powered data transformation logic.

## 1. Core Principles

- **Dual-Path Processing:** The system supports two distinct workflows: a direct AI transformation for smaller files and a more robust, two-step "config generation" process for large files to handle performance and memory constraints.
- **Component-Based Architecture:** The wizard is composed of a main container and four distinct child components for each step, and I will update the summary table to accurately represent this new, modular architecture.
- **Backend-Powered Transformation:** All heavy lifting (CSV parsing, AI calls, data pivoting) is delegated to a Node.js/Express backend (`server.js`) to keep the frontend responsive.
- **Data Integrity:** The backend is responsible for ensuring data integrity, especially during pivoting. This includes preserving data sparsity (not filling in missing date gaps) and correctly sorting date-based columns chronologically.
- **Explicit Column Order:** The backend explicitly sends a sorted `columns` array to the frontend. The frontend **must** use this array to render table headers, as the key order in JavaScript objects is not guaranteed.

---

## 2. Frontend Components

The wizard's frontend is architected as a main state container that renders different child components for each step of the process.

### A. Main Container: `CsvImportWizard.tsx`
This component is the brain of the wizard. It does not render much UI itself but is responsible for:
- **State Management**: Holding all key state variables (`file`, `originalCsv`, `aiStep`, `step`, `aiResult`, `aiResultColumns`, etc.).
- **Orchestration**: Rendering the correct child component based on the current `step` and `aiStep`.
- **Handler Functions**: Containing all the core logic for file handling (`handleFileChange`), AI interaction (`handleAITransform`, `handleConfigProcessing`), and manual import processing (`handleManualConfirm`).

### B. Child Step Components (`src/components/CsvImportWizard/`)
These are "dumb" components that primarily focus on rendering the UI for a specific step and calling handler functions passed down from the parent.
- **`UploadStep.tsx`**: Displays the file dropzone and handles the initial file selection.
- **`ChoiceStep.tsx`**: Presents the user with the "AI-Powered" vs. "Manual Import" options.
- **`PreviewStep.tsx`**: Renders the data preview table, either from the AI transformation or the manual controls (separator, transpose).
- **`MapStep.tsx`**: Shows the column mapping interface and the final normalized data preview before import.

---

## 3. Backend Server: `server.js`

The backend handles all data processing and communication with the Grok AI API.

### A. API Endpoints

- **`POST /api/grok-transform`**: Used for the small file workflow.
- **`POST /api/grok-generate-config`**: Used for the large file workflow (step 1).
- **`POST /api/apply-config`**: Used for the large file workflow (step 2).

### B. The `pivotTable` Function
This is the most complex and critical part of the backend transformation logic.
- **Purpose**: To transform data from a "long" format (one row per sale) to a "wide" format (one row per product, with dates as columns).
- **Sparsity**: It only creates columns for dates that **actually exist** in the dataset.
- **Chronological Sorting**: It performs a proper date-based sort on columns.

---

## 4. Troubleshooting Checklist

If the upload or transformation fails, check the following:
1.  **Is the parent `CsvImportWizard.tsx` passing the correct props to the active child step component?**
2.  **Is the frontend using `aiResultColumns` to render the table headers in `PreviewStep.tsx` or `MapStep.tsx`?**
3.  **Does the backend API response include the `columns` array?** Check the browser's network tab.
4.  **Are the backend logs for `pivotTable` showing correct sorting?**
5.  **Is the correct workflow (small vs. large file) being triggered in `CsvImportWizard.tsx`?**

---

## Summary Table

| Stage                     | Component/File                           | Key Function(s)                   | Critical Logic                                      |
| ------------------------- | ---------------------------------------- | --------------------------------- | --------------------------------------------------- |
| **State & Orchestration** | `CsvImportWizard.tsx`                    | `handleFileChange`, `handleAITransform` | Manages state and renders the correct step component. |
| **File Upload UI**        | `CsvImportWizard/UploadStep.tsx`         | -                                 | Renders the dropzone.                               |
| **AI/Manual Choice UI**   | `CsvImportWizard/ChoiceStep.tsx`         | -                                 | Renders the two import path choices.                |
| **Data Preview UI**       | `CsvImportWizard/PreviewStep.tsx`        | -                                 | Renders the data preview table.                     |
| **Column Mapping UI**     | `CsvImportWizard/MapStep.tsx`            | -                                 | Renders the column mapping interface.               |
| **Backend Pivot**         | `server.js`                              | `pivotTable`                      | Date normalization, chronological sort, sparsity.   |
| **API Response**          | `server.js`                              | `/apply-config` handler           | Returns `{ transformedData, columns }`.             | 