# Model Score Display Enhancement

## Overview

Added composite scores to model cards in the UI, ensuring all models display their performance metrics prominently. This provides immediate feedback on model performance for each SKU/model combination.

## Problem

1. **No Visual Score Feedback**: Users couldn't see model performance at a glance
2. **Inconsistent Score Display**: Some models showed scores, others didn't
3. **Missing Performance Context**: No easy way to compare models visually
4. **Score Mapping Issues**: Backend scores weren't properly mapped to UI state

## Solution

### 1. ModelCard UI Enhancement

Updated `ModelCard.tsx` to display composite scores prominently:

```javascript
{/* Composite Score Badge */}
{typeof model.compositeScore === 'number' ? (
  <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded border border-yellow-300 font-mono">
    Score: {model.compositeScore.toFixed(4)}
  </span>
) : typeof model.accuracy === 'number' ? (
  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded border border-blue-300 font-mono">
    Accuracy: {model.accuracy.toFixed(1)}%
  </span>
) : null}
```

### 2. Type System Updates

Added score fields to `ModelConfig` interface in `src/types/forecast.ts`:

```typescript
interface ModelConfig {
  // ... existing fields
  compositeScore?: number;
  accuracy?: number;
  parametersMeta?: ParameterMeta[];
}
```

### 3. Backend Score Mapping

Updated `useBestResultsMapping.ts` to properly map scores from backend results:

```javascript
// Set gridParameters and aiParameters in model state
if (methodResult.method === 'grid') {
  onModelUpdate(model.id, {
    gridParameters: methodResult.bestResult.parameters,
    compositeScore: methodResult.bestResult.compositeScore,
    accuracy: methodResult.bestResult.accuracy
  });
} else if (methodResult.method === 'ai') {
  onModelUpdate(model.id, {
    aiParameters: methodResult.bestResult.parameters,
    compositeScore: methodResult.bestResult.compositeScore,
    accuracy: methodResult.bestResult.accuracy
  });
}
```

### 4. BestResult Interface Update

Added `compositeScore` to the `BestResult` interface:

```typescript
interface BestResult {
  accuracy: number;
  parameters: Record<string, any>;
  mape: number;
  rmse: number;
  mae: number;
  jobId: number;
  sku: string;
  createdAt: string;
  completedAt: string;
  filePath?: string;
  predictions?: any[];
  compositeScore?: number; // Added this field
}
```

### 5. Score Calculation in Backend

Ensured composite scores are calculated in the backend using current metric weights:

```javascript
// Calculate composite score using the weights
result.compositeScore = 
  (weights.mape * result.normMAPE) +
  (weights.rmse * result.normRMSE) +
  (weights.mae * result.normMAE) +
  (weights.accuracy * result.normAccuracy);
```

**FIXED (2024-07)**: The normalization logic was updated to use batch-relative max values instead of fixed thresholds (MAPE=100%, RMSE=1, MAE=1). This prevents negative normalized values and ensures composite scores reflect relative performance within each dataset. The fix includes clamping to keep normalized values within [0, 1] range.

## Benefits

1. **Immediate Performance Feedback**: Users see scores at a glance
2. **Visual Model Comparison**: Easy to compare models side-by-side
3. **Consistent Display**: All models show scores when available
4. **Fallback Support**: Shows accuracy if composite score unavailable
5. **Real-time Updates**: Scores update when metric weights change

## Files Modified

- `src/components/ModelCard.tsx` - Added score display badge
- `src/types/forecast.ts` - Added score fields to ModelConfig interface
- `src/hooks/useBestResultsMapping.ts` - Updated score mapping logic
- `src/backend/routes.js` - Ensured composite scores are calculated

## UI Display Logic

**Priority Order:**
1. **Composite Score** (if available) - Shows as "Score: 0.8886"
2. **Accuracy** (if composite score unavailable) - Shows as "Accuracy: 85.2%"
3. **No Score** (if neither available) - Shows nothing

**Visual Design:**
- **Composite Score**: Yellow badge with 4 decimal places
- **Accuracy**: Blue badge with 1 decimal place and % symbol
- **Positioning**: Top-right of model card header
- **Font**: Monospace for consistent number display

## Testing

- All models now display scores in the UI
- Scores update when switching between GRID/AI/MANUAL badges
- Scores reflect current metric weights
- Fallback to accuracy works correctly
- No linter errors with new type definitions

## Future Considerations

- Could add tooltips explaining score calculation
- Could add color coding based on score ranges
- Could add score trend indicators (improving/declining)
- Could add score comparison with previous runs 