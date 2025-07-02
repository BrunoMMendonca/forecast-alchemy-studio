# Export Optimization Results Weight Integration

## Overview

Fixed the CSV export system to use current metric weights when determining "best result" instead of relying on stored weights from when jobs were completed. This ensures the export reflects the current user preferences for metric importance.

## Problem

1. **Stale Weight Usage**: CSV export used weights from when jobs were completed, not current settings
2. **Inconsistent Best Results**: "Best result" in export didn't match current weight preferences
3. **User Confusion**: Export showed different "best" models than what UI displayed
4. **Weight Changes Ignored**: Changing metric weights in settings didn't affect export results

## Solution

### 1. Remove Stored Best Result Logic

**Before:**
```javascript
// Used stored bestResult from job completion
isBestResult: resultData.bestResult && 
    modelResult.modelType === resultData.bestResult.modelType &&
    JSON.stringify(modelResult.parameters) === JSON.stringify(resultData.bestResult.parameters)
```

**After:**
```javascript
// Will be calculated later with current weights
isBestResult: false
```

### 2. Recalculate Composite Scores with Current Weights

Updated CSV export to recalculate all composite scores using current weights:

```javascript
// Get metric weights from query parameters (same as used in best result calculation)
const mapeWeight = parseFloat(req.query.mapeWeight) || 0.4;
const rmseWeight = parseFloat(req.query.rmseWeight) || 0.3;
const maeWeight = parseFloat(req.query.maeWeight) || 0.2;
const accuracyWeight = parseFloat(req.query.accuracyWeight) || 0.1;
const weights = { mape: mapeWeight, rmse: rmseWeight, mae: maeWeight, accuracy: accuracyWeight };

console.log(`[CSV Export] Using weights:`, weights);
```

### 3. Recalculate Best Results After Score Computation

After computing composite scores, recalculate best results:

```javascript
// Calculate normalization factors and composite scores for each job
for (const [jobId, jobResults] of jobResultsMap) {
  if (jobResults.length === 0) continue;
  
  // Find max values for normalization (avoid division by zero)
  const maxMAPE = Math.max(...jobResults.map(r => r.mape || 0), 1);
  const maxRMSE = Math.max(...jobResults.map(r => r.rmse || 0), 1);
  const maxMAE = Math.max(...jobResults.map(r => r.mae || 0), 1);
  
  // Calculate normalized metrics and composite scores
  jobResults.forEach(result => {
    // Normalized metrics (0-1 scale, higher is better)
    result.normAccuracy = (result.accuracy || 0) / 100;
    result.normMAPE = 1 - ((result.mape || 0) / maxMAPE);
    result.normRMSE = 1 - ((result.rmse || 0) / maxRMSE);
    result.normMAE = 1 - ((result.mae || 0) / maxMAE);
    
    // Composite score using current weights
    result.compositeScore =
      (weights.mape * result.normMAPE) +
      (weights.rmse * result.normRMSE) +
      (weights.mae * result.normMAE) +
      (weights.accuracy * result.normAccuracy);
  });
  
  // Find the best result for this job using current weights
  const bestResult = jobResults.reduce((best, curr) =>
    (curr.compositeScore > (best.compositeScore || -Infinity)) ? curr : best, jobResults[0]);
  
  // Mark the best result
  jobResults.forEach(result => {
    result.isBestResult = result === bestResult;
  });
  
  console.log(`[CSV Export] Job ${jobId} best result:`, {
    modelType: bestResult.modelType,
    method: bestResult.method,
    compositeScore: bestResult.compositeScore,
    weights: weights
  });
}
```

### 4. Frontend Weight Passing

Updated frontend to pass current weights to export endpoint:

```javascript
// In OptimizationResultsExporter.tsx
const exportResults = async () => {
  const params = new URLSearchParams({
    // ... other params
    mapeWeight: globalSettings.mapeWeight.toString(),
    rmseWeight: globalSettings.rmseWeight.toString(),
    maeWeight: globalSettings.maeWeight.toString(),
    accuracyWeight: globalSettings.accuracyWeight.toString()
  });
  
  const response = await fetch(`/api/jobs/export-results?${params}`);
};
```

## Benefits

1. **Consistent Results**: Export matches current UI best results
2. **Weight Changes Reflected**: Changing metric weights affects export immediately
3. **Accurate Best Results**: "Best result" in CSV uses current preferences
4. **User Control**: Export respects current metric importance settings
5. **Debugging Support**: Added logging to track weight usage

## Files Modified

- `src/backend/routes.js` - Updated CSV export logic to recalculate scores and best results
- `src/components/OptimizationResultsExporter.tsx` - Pass current weights to export endpoint

## Technical Details

### Weight Flow
1. **Frontend**: Gets current weights from global settings
2. **API Call**: Passes weights as query parameters to export endpoint
3. **Backend**: Uses weights to recalculate composite scores
4. **Best Result**: Determined by highest composite score using current weights
5. **CSV Output**: Shows best result based on current preferences

### Score Calculation
```javascript
// Normalized metrics (0-1 scale, higher is better)
normAccuracy = accuracy / 100
normMAPE = 1 - (mape / maxMAPE)
normRMSE = 1 - (rmse / maxRMSE)
normMAE = 1 - (mae / maxMAE)

// Composite score using current weights
compositeScore = (mapeWeight * normMAPE) + (rmseWeight * normRMSE) + 
                 (maeWeight * normMAE) + (accuracyWeight * normAccuracy)
```

## Testing

- Export best results match UI best results
- Changing metric weights affects export immediately
- All models have composite scores in export
- Best result flag is correctly set
- Weight logging shows correct values

## Future Considerations

- Could add weight validation in backend
- Could add weight change tracking/history
- Could add export templates with different weight sets
- Could add weight comparison between different exports 