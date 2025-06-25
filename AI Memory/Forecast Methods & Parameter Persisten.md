# Forecast Methods & Parameter Persistence: Implementation Guide

## 1. Core Principles

- **Auto-selection** of the best method (AI > Grid) should only occur when new optimizations run (e.g., new data, data cleaning, or setup changes).
- **Manual mode** and user selections must persist across all navigation (SKU changes, page changes, etc.) unless a new optimization is triggered.
- **Parameters** for each method (AI, Grid, Manual) are stored and restored independently.
- **Backend Source of Truth**: All method selections, parameters, and optimization results are now stored in the backend database, not localStorage.

---

## 2. How It Works

### A. Method Selection Logic

- **On Mount or SKU/Model Change:**
  - The app checks the backend database for a previously selected method for the current SKU/model.
  - If a selection exists in the database, it is used (e.g., if the user previously chose Manual, it stays Manual).
  - If no selection exists (e.g., after a new optimization), the app auto-selects the best available method:
    - **AI** is chosen if available and enabled.
    - **Grid** is chosen if AI is unavailable.
    - **Manual** is only auto-selected if neither AI nor Grid is available.

- **On User Method Change:**
  - When the user selects a method (Manual, Grid, or AI), this choice is saved in the backend database as the `selected` method for that SKU/model.
  - This selection is now persistent and will be restored on all future visits, page reloads, or navigation events.

### B. Parameter Persistence

- **Each method (AI, Grid, Manual) has its own parameter set** stored in the backend database.
- When switching methods, the app loads the parameters for the selected method from the backend.
- When switching to Manual for the first time after a new optimization, Manual parameters are initialized from the latest Grid parameters (if available).
- User-edited Manual parameters are always preserved unless a new optimization runs.

### C. When Auto-Selection/Overwrite Happens

- **Only when a new optimization runs** (triggered by new data, data cleaning, or setup changes):
  - The best method is auto-selected (AI > Grid).
  - Grid parameters are used as the new baseline for Manual.
  - This is the only time user selections and Manual parameters may be overwritten.

---

## 3. Technical Details

### A. Backend Database Structure

- The database stores method selections and parameters per SKU/model combination.
- For each SKU/model, it stores:
  - `ai`, `grid`, `manual`: parameter sets for each method
  - `selected`: the currently selected method (as chosen by the user or auto-selected after optimization)

### B. Key Code Points

- **On mount or SKU/model change:**  
  The frontend fetches method selections and parameters from the backend API.
  If no selection exists, it auto-selects the best method based on available results.
- **On method change:**  
  The frontend updates both the UI state and sends the selection to the backend API.
- **On parameter change:**  
  Parameters for the current method are saved to the backend via API calls.
- **On new optimization:**  
  The backend updates the database with new AI/Grid results, and the best method is auto-selected. Manual parameters are reset to the new Grid parameters.

### C. Persistence

- All method selections and parameters are stored in the backend database.
- The frontend fetches this data via authenticated API calls.
- The UI always reflects the backend state, ensuring persistence across navigation and sessions.

---

## 4. Troubleshooting Checklist

If persistence fails in the future, check the following:

1. **Is the backend API returning the correct method selections and parameters?**
2. **Is the selected method (`selected`) being read from the backend and used to set the UI state?**
3. **Is the selected method being updated in the backend when the user changes it?**
4. **Are parameters for each method being stored and restored independently in the backend?**
5. **Is auto-selection only happening after new optimizations, and not on every mount/navigation?**
6. **Are API calls to the backend succeeding and returning the expected data?**

---

## Summary Table

| Event                        | Method Selection         | Parameter Source         | Overwrites User? |
|------------------------------|-------------------------|-------------------------|------------------|
| New optimization runs        | Auto-select (AI > Grid) | Grid → Manual baseline  | Yes              |
| User changes method/params   | User selection persists | Each method's own backend storage | No               |
| SKU/page navigation          | Persist from backend    | Persist from backend    | No               |

---

## 5. Migration from localStorage

**Historical Context**: Previously, method selections and parameters were stored in localStorage. This has been migrated to the backend database to support:
- Multi-tenancy and user isolation
- Better data persistence and reliability
- Centralized data management
- Future collaborative features

**Current State**: All method selections and parameters are now stored in and retrieved from the backend database via authenticated API calls.

---

**If you ever need to restore this logic, reference this guide and ensure:**
- Method selection is always read from and written to the backend database.
- Auto-selection only happens after new optimizations.
- User choices are never overwritten except after new optimizations.
- All API calls include proper authentication and error handling.