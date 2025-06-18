# Workflow Summary

## 1. Main Steps

### Step 1: Upload (Finished/Adjustments allowed)
- User uploads sales data via CSV.
- An import wizard allows the user to transpose their CSV, define date formats, and map columns to "aggregatable fields" (used later for grouping/analysis).

### Step 2: Clean and Prepare (Finished/Adjustments allowed)
- User reviews and optionally edits/cleans data (outlier detection, manual edits).
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
  - **Methods:**
    - **Grid:** Try parameter combinations, pick the best for each model/SKU.
    - **AI:** Use GROK-3 to review grid results and propose improvements (if enabled).
    - **Manual:** User can adjust parameters per model/SKU (defaults to grid results). Manual mode does not generate background optimizations.
  - User can see which SKUs/models are optimized (and by which method), queued, or in progress.
  - User can manually adjust parameters (Manual mode), but cannot trigger optimization directly.
  - The user can pick the best model for each SKU. Automatic model selection happens, but the user can override it.
  - **Persistence:** All results, selections, and queue state are persisted to localStorage and restored on reload.

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
1. **Is the queue state being updated and persisted correctly?**
2. **Are optimizations only triggered by the correct events (see `Optimization reasons.md`)?**
3. **Is AI job addition/removal respecting the current AI enablement settings?**
4. **Are user selections and manual parameters persisting across navigation and reloads?**
5. **Is the UI reflecting the true state of the queue, optimizations, and results?**

---

## 3. Summary Table

| Step         | Trigger/Event                | System Action                        | Persistence | User Control |
|--------------|------------------------------|--------------------------------------|-------------|--------------|
| Upload       | CSV upload                   | Queue all optimizations (AI/Grid)    | Yes         | Yes          |
| Clean/Prepare| Data edit/clean              | Queue optimizations for affected SKU | Yes         | Yes          |
| Explore      | Navigation                   | No optimization, just view           | Yes         | Yes          |
| Forecast     | Data/settings change         | Queue optimizations as needed        | Yes         | Yes          |
| Tune         | Manual forecast adjustment   | No queue, direct user edit           | Yes         | Yes          |
| Settings     | Change AI/periods            | Queue/clear jobs as needed           | Yes         | Yes          |

---

**For more details on optimization triggers, queue processing, and persistence, see:**
- `Optimization reasons.md`
- `Queue Processing & Job Management.md`
- `Forecast Methods & Parameter Persisten.md`






