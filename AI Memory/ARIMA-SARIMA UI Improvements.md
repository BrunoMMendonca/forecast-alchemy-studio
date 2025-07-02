# ARIMA/SARIMA UI Improvements

## Overview

Removed the "Auto ARIMA" toggle from the UI and improved parameter display for ARIMA and SARIMA models, ensuring they show individual parameters (p, d, q, etc.) in both GRID and MANUAL modes.

## Problem

1. **Confusing UI**: ARIMA showed an "Auto ARIMA" toggle that was confusing for users
2. **Inconsistent Parameter Display**: Parameters weren't showing correctly in different modes
3. **CSV Export Issues**: Export showed "auto: true" instead of actual fitted parameters
4. **Grid vs Manual Confusion**: Users couldn't easily distinguish between auto and manual parameter sets

## Solution

### 1. Remove Auto Toggle from UI

**Before:**
- ARIMA showed "Auto ARIMA" toggle in UI
- Toggle controlled whether to use auto or manual parameters
- Confusing for users

**After:**
- No "Auto ARIMA" toggle in UI
- ARIMA and SARIMA show individual parameters (p, d, q, etc.)
- Clear distinction between GRID and MANUAL modes

### 2. Grid Search Behavior

**ARIMA Grid Search:**
```javascript
// Only run auto configuration
return [{ auto: true, verbose: false }];
```

**SARIMA Grid Search:**
```javascript
// Only run auto configuration with correct seasonal period
return [{ auto: true, s: seasonalPeriod || 12, verbose: false }];
```

### 3. Manual Mode Behavior

**ARIMA Manual:**
- Users can set p, d, q parameters directly
- No auto configuration
- Full parameter control

**SARIMA Manual:**
- Users can set p, d, q, P, D, Q, s parameters directly
- No auto configuration
- Full parameter control

### 4. Parameter Display Logic

Updated `ParameterSliders.tsx` to filter out the `auto` parameter:

```javascript
// For ARIMA/SARIMA, filter out the 'auto' parameter from visibleParams
const filteredParams = isArimaOrSarima
  ? visibleParams.filter(p => p.name !== 'auto')
  : visibleParams;
```

### 5. CSV Export Improvements

Updated CSV export to show fitted parameters instead of just "auto":

```javascript
// For ARIMA/SARIMA, if parameters include 'auto: true' and also fitted p/d/q, export those instead
if ((result.modelId === 'arima' || result.modelId === 'sarima') && 
    paramObj.auto === true && 
    (paramObj.p !== undefined || paramObj.P !== undefined)) {
  // Export individual parameters instead of auto flag
  const exportParams = {};
  if (result.modelId === 'arima') {
    if (paramObj.p !== undefined) exportParams.p = paramObj.p;
    if (paramObj.d !== undefined) exportParams.d = paramObj.d;
    if (paramObj.q !== undefined) exportParams.q = paramObj.q;
  } else { // sarima
    if (paramObj.p !== undefined) exportParams.p = paramObj.p;
    if (paramObj.d !== undefined) exportParams.d = paramObj.d;
    if (paramObj.q !== undefined) exportParams.q = paramObj.q;
    if (paramObj.P !== undefined) exportParams.P = paramObj.P;
    if (paramObj.D !== undefined) exportParams.D = paramObj.D;
    if (paramObj.Q !== undefined) exportParams.Q = paramObj.Q;
    if (paramObj.s !== undefined) exportParams.s = paramObj.s;
  }
  result.parameters = JSON.stringify(exportParams);
}
```

### 6. Backend Metadata Updates

**ARIMA Metadata:**
```javascript
parameters: [
  { name: 'p', type: 'number', default: 1, visible: true, ... },
  { name: 'd', type: 'number', default: 1, visible: true, ... },
  { name: 'q', type: 'number', default: 1, visible: true, ... },
  { name: 'auto', type: 'boolean', default: true, visible: false, ... }, // Hidden from UI
  { name: 'verbose', type: 'boolean', default: false, visible: false, ... }
]
```

## Benefits

1. **Clearer UI**: No confusing "Auto" toggle
2. **Better UX**: Users see actual parameters being used
3. **Consistent Display**: Same parameter fields in GRID and MANUAL modes
4. **Improved CSV Export**: Shows fitted parameters instead of "auto"
5. **Modular Design**: Each model controls its own parameter display

## Files Modified

- `src/backend/models/ARIMA.js` - Added numeric parameters, hid auto parameter
- `src/backend/models/SARIMA.js` - Already had proper parameter structure
- `src/components/ParameterSliders.tsx` - Filter out auto parameter for ARIMA/SARIMA
- `src/backend/routes.js` - Updated CSV export logic
- `src/backend/optimization/GridOptimizer.js` - ARIMA/SARIMA only use auto in grid

## User Experience

**GRID Mode:**
- Shows p, d, q (and P, D, Q, s for SARIMA) as read-only
- Parameters populated with auto-fitted values
- Clear indication these are optimized parameters

**MANUAL Mode:**
- Shows p, d, q (and P, D, Q, s for SARIMA) as editable sliders
- Users can adjust parameters manually
- Full control over model configuration

## Future Considerations

- Easy to add more ARIMA/SARIMA parameters if needed
- Consistent pattern for other models with auto/manual modes
- CSV export always shows meaningful parameters 