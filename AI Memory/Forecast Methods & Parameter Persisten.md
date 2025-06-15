# Forecast Methods & Parameter Persistence: Implementation Guide

## 1. Core Principles

- **Auto-selection** of the best method (AI > Grid) should only occur when new optimizations run (e.g., new data, data cleaning, or setup changes).
- **Manual mode** and user selections must persist across all navigation (SKU changes, page changes, etc.) unless a new optimization is triggered.
- **Parameters** for each method (AI, Grid, Manual) are stored and restored independently.

---

## 2. How It Works

### A. Method Selection Logic

- **On Mount or SKU/Model Change:**
  - The app checks the cache for a previously selected method for the current SKU/model.
  - If a selection exists in the cache, it is used (e.g., if the user previously chose Manual, it stays Manual).
  - If no selection exists (e.g., after a new optimization), the app auto-selects the best available method:
    - **AI** is chosen if available and enabled.
    - **Grid** is chosen if AI is unavailable.
    - **Manual** is only auto-selected if neither AI nor Grid is available.

- **On User Method Change:**
  - When the user selects a method (Manual, Grid, or AI), this choice is saved in the cache as the `selected` method for that SKU/model.
  - This selection is now persistent and will be restored on all future visits, page reloads, or navigation events.

### B. Parameter Persistence

- **Each method (AI, Grid, Manual) has its own parameter set** stored in the cache.
- When switching methods, the app loads the parameters for the selected method from the cache.
- When switching to Manual for the first time after a new optimization, Manual parameters are initialized from the latest Grid parameters (if available).
- User-edited Manual parameters are always preserved unless a new optimization runs.

### C. When Auto-Selection/Overwrite Happens

- **Only when a new optimization runs** (triggered by new data, data cleaning, or setup changes):
  - The best method is auto-selected (AI > Grid).
  - Grid parameters are used as the new baseline for Manual.
  - This is the only time user selections and Manual parameters may be overwritten.

---

## 3. Technical Details

### A. Cache Structure

- The cache is a nested object: `cache[sku][modelId]`
- For each SKU/model, it stores:
  - `ai`, `grid`, `manual`: parameter sets for each method
  - `selected`: the currently selected method (as chosen by the user or auto-selected after optimization)

### B. Key Code Points

- **On mount or SKU/model change:**  
  In `OptimizeForecast.tsx`, the effect checks for `cache[sku][modelId].selected` and uses it if present.  
  If not, it auto-selects the best method based on available results.
- **On method change:**  
  The handler updates both the UI state and the cache’s `selected` field.
- **On parameter change:**  
  Parameters for the current method are saved in the cache under the appropriate method key.
- **On new optimization:**  
  The cache is updated with new AI/Grid results, and the best method is auto-selected. Manual parameters are reset to the new Grid parameters.

### C. Persistence

- The cache is saved to `localStorage` on every update.
- On page load, the cache is loaded from `localStorage`.
- The UI always reflects the cache state, ensuring persistence across navigation.

---

## 4. Troubleshooting Checklist

If persistence fails in the future, check the following:

1. **Is the cache being loaded from localStorage on page load?**
2. **Is the selected method (`selected`) being read from the cache and used to set the UI state?**
3. **Is the selected method being updated in the cache when the user changes it?**
4. **Are parameters for each method being stored and restored independently?**
5. **Is auto-selection only happening after new optimizations, and not on every mount/navigation?**
6. **Is the cache being saved to localStorage after every change?**

---

## Summary Table

| Event                        | Method Selection         | Parameter Source         | Overwrites User? |
|------------------------------|-------------------------|-------------------------|------------------|
| New optimization runs        | Auto-select (AI > Grid) | Grid → Manual baseline  | Yes              |
| User changes method/params   | User selection persists | Each method’s own cache | No               |
| SKU/page navigation          | Persist from cache      | Persist from cache      | No               |

---

**If you ever need to restore this logic, reference this guide and ensure:**
- Method selection is always read from and written to the cache.
- Auto-selection only happens after new optimizations.
- User choices are never overwritten except after new optimizations.