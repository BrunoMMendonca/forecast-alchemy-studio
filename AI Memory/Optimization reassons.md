# Optimization reasons

1. **CSV Upload:** Whenever a CSV is uploaded ("Upload"), after clicking "Confirm Mapping and Import", optimization runs to detect the best parameters of all models, for all SKUs, using up to 2 different methods (AI, if enabled, and Grid Search).  
   → **Scope:** ALL_MODELS / ALL_SKU / ALL_METHODS
   
2. **Data Cleaning:** When a SKU's historic data is cleaned ("Clean and prepare"), either manually or via CSV import, optimization runs to find the best parameters of all models for that single SKU.  
   → **Scope:** ALL_MODELS / 1_SKU / ALL_METHODS

3. **Enabling AI Optimization:** When AI Optimization is enabled, the system optimizes the parameters of all models for all SKUs using the AI method.  
   → **Scope:** ALL_MODELS / ALL_SKU / 1_METHOD (AI)

---

**Note:**
- AI jobs are only added to the queue if both global AI features and AI model optimization are enabled at the time of job creation. If AI is disabled, only Grid jobs are added.
- All optimizations are managed through the queue system, which ensures jobs are processed sequentially and according to current settings.








