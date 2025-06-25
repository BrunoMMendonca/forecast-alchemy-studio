# Workflow Summary

## 1. Main Steps

### Step 0: Existing Data Detection & Deduplication (New)
- On app load or CSV upload, the frontend hashes the raw CSV (SHA-256, 30 hex chars) and checks with the backend for duplicates via `/api/check-csv-duplicate`.
- The backend scans for existing processed datasets (JSONs with `csvHash`) and returns any matches.
- If a duplicate is found, the user can load the existing dataset directly, skipping the import wizard.
- The frontend also presents a list of all detected datasets for manual selection ("Continue with Existing Data").

### Step 1: Choose your data (Finished/Adjustments allowed)
- User uploads sales data via the `CsvImportWizard.tsx` component **if no duplicate is found**.
- The wizard provides two main paths for data processing:
  - **AI-Powered Transformation**: The user is prompted to let the AI automatically clean, pivot, and prepare the data. This is the recommended path.
    - **Small files** are transformed directly via a single API call.
    - **Large files** trigger a more robust two-step process where the AI first generates a transformation `config` from a sample, which is then applied to the full dataset on the backend. This avoids timeouts and performance issues.
  - **Manual Import**: The user can opt to manually transpose the data and map columns.
- The output of this step is a clean, wide-format dataset ready for the subsequent steps, with consistent metadata (`summary`, `columnRoles`, `name`, `csvHash`).
- For a deep technical dive, see `Upload Wizard & Data Transformation.md`.

### Step 2: Clean and Prepare (Finished/Adjustments allowed)
- User reviews the transformed data and can optionally perform further cleaning (outlier detection, manual edits).
- Import/export of cleaning data is supported via "Import Cleaning Data" and "Export Cleaning Data" buttons.
- User can freely navigate between "Clean and Prepare" and other pages for flexibility.

### Step 3: Explore (Finished/Adjustments allowed)
- User visually inspects cleaned data, aggregates, trends, and other analytics.

### Step 4: Forecast & Optimize (Ongoing)
- **Optimization**: Adjusts model parameters to get the best forecast for each SKU/model.
  - Automatic optimization is triggered by:
    - New data upload (Step 1)
    - Data cleaning (Step 2)
    - Relevant settings changes (see `Optimization reasons.md`)
  - Only SKUs that have changed are re-optimized (minimizing unnecessary work and API calls).
  - **Queue System**: All optimizations are managed via a global queue, ensuring jobs are processed sequentially and according to current settings (see `Queue Processing & Job Management.md`).
  - **Models & Methods:** The backend now runs a full suite of professional-grade forecasting models, including `Simple Exponential Smoothing`, `Holt-Winters`, `SARIMA`, and more.
    - **Grid Search:** The system runs a comprehensive grid search across all applicable models and their parameter combinations to find the best-fitting forecast for each SKU.
    - **AI-Enhanced Optimization:** If enabled, the system can use AI to intelligently refine the search for optimal parameters.
    - **Manual Mode:** Users can always manually override parameters for any model.
  - User can see which SKUs/models are optimized (and by which method), queued, or in progress.
  - User can manually adjust parameters (Manual mode), but cannot trigger optimization directly.
  - The user can pick the best model for each SKU. Automatic model selection happens, but the user can override it.
  - **Persistence:** All results, selections, and queue state are persisted to the backend database and restored on reload. The backend serves as the single source of truth for all application data.

- **Tune (In Development):**
  - With a model selected for each SKU, a "final" single forecast per SKU is shown alongside cleaned historical data.
  - User can manually adjust forecast values for each time period (not historical data).
  - An AI chat assists with bulk or complex forecast adjustments (e.g., "Increase forecast for SKU X by 10% for next 3 months").

### Settings
- Forecast periods (future time periods) can be set in general settings.
- AI optimization (GROK-3) can be enabled/disabled in general settings.
- All settings changes are reflected in the queue and optimization logic.

---

## 2. Troubleshooting Checklist

If the workflow does not behave as expected, check:
1. **Is deduplication working?** Are both frontend and backend hashing the exact same raw CSV string, and is the hash stored and checked consistently?
2. **Is the queue state being updated and persisted correctly?**
3. **Are optimizations only triggered by the correct events (see `Optimization reasons.md`)?**
4. **Is AI job addition/removal respecting the current AI enablement settings?**
5. **Are user selections and manual parameters persisting across navigation and reloads?**
6. **Is the UI reflecting the true state of the queue, optimizations, and results?**

---

## 3. Summary Table

| Step                  | Trigger/Event                | System Action                        | Persistence | User Control |
|-----------------------|------------------------------|--------------------------------------|-------------|--------------|
| Existing Data Check   | App load/CSV upload          | Check for duplicates, present options| Backend DB  | Yes          |
| Choose your data      | CSV upload                   | Initiate AI/manual import wizard     | Backend DB  | Yes          |
| Clean/Prepare         | Data edit/clean              | Queue optimizations for affected SKU | Backend DB  | Yes          |
| Explore               | Navigation                   | No optimization, just view           | Backend DB  | Yes          |
| Forecast              | Data/settings change         | Queue optimizations as needed        | Backend DB  | Yes          |
| Tune                  | Manual forecast adjustment   | No queue, direct user edit           | Backend DB  | Yes          |
| Settings              | Change AI/periods            | Queue/clear jobs as needed           | Backend DB  | Yes          |

---

**For more details on deduplication, optimization triggers, queue processing, and persistence, see:**
- `Upload Wizard & Data Transformation.md`
- `Optimization reasons.md`
- `Queue Processing & Job Management.md`
- `Forecast Methods & Parameter Persisten.md`






