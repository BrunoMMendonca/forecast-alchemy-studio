# Modular Grid Search Implementation

## Overview

Implemented a modular approach to grid search where each model controls its own grid search behavior through static methods, ensuring all models (including non-optimizable ones) are always run and scored for fair comparison.

## Problem

Previously, models with no tunable parameters (like Linear Trend, Seasonal Naive) were either:
- Skipped entirely from grid search
- Not included in job creation
- Missing from CSV exports
- Not appearing in UI results

This created an inconsistent experience where users couldn't compare all available models side-by-side.

## Solution

### 1. BaseModel Static Methods

Added two static methods to `BaseModel` that each model can override:

```javascript
// Determines if model should be included in grid search
static shouldIncludeInGridSearch() {
  return true; // Default: include all models
}

// Returns grid search parameters for this model
static getGridSearchParameters(seasonalPeriod = null) {
  // Default: return default parameters if no optimization parameters
  if (this.metadata.optimizationParameters && Object.keys(this.metadata.optimizationParameters).length === 0) {
    return [this.metadata.defaultParameters || {}];
  }
  return null; // Let GridOptimizer handle parameter grid
}
```

### 2. Model-Specific Overrides

**Linear Trend & Seasonal Naive:**
```javascript
static getGridSearchParameters(seasonalPeriod = null) {
  // These models have no tunable parameters, so run once with defaults
  return [this.metadata.defaultParameters];
}
```

**ARIMA & SARIMA:**
- Grid search only runs auto configuration
- Manual mode allows parameter tuning
- No "Auto" toggle in UI

### 3. GridOptimizer Integration

Updated `generateParameterCombinations()` to use model methods:

```javascript
// Check if model should be included in grid search
if (!modelClass.shouldIncludeInGridSearch()) {
  return []; // Model opts out
}

// Get grid search parameters from model itself
const modelGridParams = modelClass.getGridSearchParameters(seasonalPeriod);
if (modelGridParams !== null) {
  return modelGridParams; // Model provides its own parameters
}
```

### 4. Job Creation Integration

Updated job creation logic to respect model preferences:

```javascript
// Check if model should be included in grid search
if (method === 'grid' && modelClass && !modelClass.shouldIncludeInGridSearch()) {
  jobsSkipped++;
  continue;
}
```

### 5. CSV Export Integration

Updated `extractBestResultsPerModelMethod()` to only include models that should be in grid search:

```javascript
// Check if model should be included in grid search
if (!modelClass || !modelClass.shouldIncludeInGridSearch()) {
  continue; // Skip models that opt out
}
```

## Benefits

1. **Modular**: Each model controls its own grid search behavior
2. **Extensible**: New models can easily define custom grid search logic
3. **Consistent**: All models get scored and appear in UI/CSV
4. **Maintainable**: No hardcoded special cases scattered throughout codebase
5. **Flexible**: Models can opt out of grid search entirely if needed

## Files Modified

- `src/backend/models/BaseModel.js` - Added static methods
- `src/backend/models/LinearTrend.js` - Added grid search override
- `src/backend/models/SeasonalNaive.js` - Added grid search override
- `src/backend/optimization/GridOptimizer.js` - Updated to use model methods
- `src/backend/routes.js` - Updated job creation and CSV export logic

## Testing

- All 9 models now appear in optimization results
- Each model has a composite score
- CSV export includes all models
- UI displays scores for all models
- Non-optimizable models run once with defaults

## Future Considerations

- Models can override `shouldIncludeInGridSearch()` to return `false` if needed
- Models can provide custom parameter sets for grid search
- Easy to add new models with custom grid search behavior 