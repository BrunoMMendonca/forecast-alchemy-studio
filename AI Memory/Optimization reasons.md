# Optimization reasons

There are 2 optimization methods GRID and AI.
The AI method is disablable in the setings.
The AI method uses the GRID method results as a source to prompt AI.

1. **CSV Upload:** Whenever a CSV is uploaded ("Upload"), after clicking "Confirm Mapping and Import", optimization runs to detect the best parameters of all models, for all SKUs, using up to 2 different methods (AI, if enabled, and Grid).
   → **Scope:** ALL_MODELS / ALL_SKU / ALL_METHODS
   
2. **Data Cleaning:** When a SKU's historic data is cleaned ("Clean and prepare"), either manually or via CSV import, optimization runs to find the best parameters of all models for the cleaned SKU. Multiple single SKU jobs can be added for CSV import.
   → **Scope:** ALL_MODELS / 1_SKU / ALL_METHODS

3. **Enabling AI Optimization:** When AI Optimization is enabled, the system optimizes the parameters of all models for all SKUs using the AI method.  
   → **Scope:** ALL_MODELS / ALL_SKU / 1_METHOD (AI)

4. **Config change:** If a configuration changes the expected result of the forecasts (eg: forecast horizon)
   → **Scope:** ALL_MODELS / ALL_SKU / ALL_METHODS

5. **Metric Weight Changes:** When the composite score weights (MAPE, RMSE, MAE, Accuracy) are changed in settings, optimization runs to re-evaluate which parameter set is "best" for each model. This is necessary because changing weights changes the criteria for selecting the optimal parameters.
   → **Scope:** ALL_MODELS / ALL_SKU / ALL_METHODS
---

**Note:**
- AI jobs are only added to the queue if both global AI features and AI model optimization are enabled at the time of job creation. If AI is disabled, only Grid jobs are added.
- All optimizations are managed through the queue system, which ensures jobs are processed sequentially and according to current settings.
- **UI/UX Changes**: Recent UI/UX improvements (fullscreen modal, floating elements, chart enhancements) do not affect optimization triggers. These are purely interface improvements that enhance user experience without changing the underlying optimization logic or triggers. 