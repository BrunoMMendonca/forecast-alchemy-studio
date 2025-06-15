Optimization reassons

1- Whenever a CSV is uploaded ("Upload"), after clicking in "Confirm Mapping and Import", optimization runs to detect the best parameters of all models, of all SKUs, in up to 2 different methods (AI (if enabled) and Grid Search). -> ALL_MODELS/ALL_SKU/ALL_METHODS
2- When a SKU historic data is cleaned ("Clean and prepare"), manually or via csv import, optimization runs to find the best parameters of all models for that 1 SKU. -> ALL_MODELS/1_SKU/ALL_METHODS
3- When AI Optimization is enabled, we need to optimize the parameters of all models for all SKU for the AI method. -> ALL_MODELS/ALL_SKU/1_METHOD








