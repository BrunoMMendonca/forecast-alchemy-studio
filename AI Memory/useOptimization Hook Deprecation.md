# useOptimization Hook Deprecation: Migration to Backend-Driven State

## 1. Core Problem / Use Case

The `useOptimization` hook was a legacy frontend optimization system that was disabled and replaced by the robust backend job queue system. However, it was still being used to provide `isOptimizing` and `optimizingModel` state to UI components, creating confusion and architectural inconsistency.

## 2. Migration Solution

### A. Problem
- `useOptimization` hook was disabled and returned `null` for all optimization requests
- Components still depended on it for optimization state (`isOptimizing`, `optimizingModel`)
- Backend system already provided this information via `useBackendJobStatus`

### B. Solution
- **Removed `useOptimization` hook entirely** - no longer needed
- **Updated component hierarchy** to pass backend optimization state down from `ForecastPage` → `StepContent` → `ForecastEngine`
- **Simplified state management** - single source of truth from backend

### C. Changes Made

1. **ForecastPage.tsx**: Added `isOptimizing={summary?.isOptimizing ?? false}` prop to `StepContent`
2. **StepContent.tsx**: 
   - Added `isOptimizing?: boolean` to `StepContentProps` interface
   - Passed `isOptimizing` prop to `ForecastEngine`
3. **ForecastEngine.tsx**:
   - Removed `useOptimization` import and usage
   - Added `isOptimizing?: boolean` to props
   - Set `optimizingModel={null}` (backend doesn't provide granular model-level state)
   - Fixed SKU extraction to handle both `sku` and `'Material Code'` fields
4. **Deleted `src/hooks/useOptimization.ts`** - no longer needed

## 3. Key Code Pointers

| Area | File | Change | Purpose |
|------|------|--------|---------|
| **State Source** | `src/hooks/useBackendJobStatus.ts` | - | Provides `summary.isOptimizing` from backend |
| **Page Level** | `src/pages/ForecastPage.tsx` | Added `isOptimizing` prop | Passes backend state to StepContent |
| **Step Level** | `src/components/StepContent.tsx` | Added `isOptimizing` prop | Passes state to ForecastEngine |
| **Component Level** | `src/components/ForecastEngine.tsx` | Removed hook, added prop | Uses backend state instead of local hook |
| **Deleted** | `src/hooks/useOptimization.ts` | Removed entirely | No longer needed |

## 4. Benefits Achieved

### A. Architectural Consistency
- ✅ Single source of truth for optimization state (backend)
- ✅ Consistent with documented backend-first architecture
- ✅ Eliminates confusion between frontend and backend optimization

### B. Code Simplification
- ✅ Removed unnecessary hook layer
- ✅ Simplified component dependencies
- ✅ Reduced maintenance overhead

### C. State Management
- ✅ Real-time optimization state from backend
- ✅ Consistent with job queue monitoring
- ✅ No more disabled/placeholder code

## 5. Technical Details

### A. SKU Field Handling
The migration also fixed a type issue with SKU extraction:
```typescript
// Before: Only handled 'sku' field
const availableSKUs = Array.from(new Set(data.map(d => d.sku))).sort();

// After: Handles both 'sku' and 'Material Code' fields
const availableSKUs = Array.from(new Set(data.map(d => String(d.sku || d['Material Code'])))).sort();
```

### B. Optimization State Granularity
- **Backend provides**: `summary.isOptimizing` (global optimization state)
- **Frontend needs**: `isOptimizing` (global) + `optimizingModel` (specific model)
- **Solution**: Set `optimizingModel={null}` since backend doesn't provide model-level granularity
- **Impact**: UI shows global optimization state, not per-model state

## 6. Migration Status

**Status**: ✅ **COMPLETED**
- All components updated to use backend optimization state
- `useOptimization` hook removed
- No breaking changes to user experience
- Architecture now fully aligned with backend-first design

## 7. Future Considerations

If per-model optimization state is needed in the future:
1. **Backend Enhancement**: Add model-level optimization tracking to job system
2. **Frontend Update**: Pass model-specific state from backend to components
3. **UI Enhancement**: Show per-model optimization progress

---

**Last Updated**: [Current Date]
**Migration Status**: ✅ **COMPLETED**
**Impact**: Cleaner architecture, single source of truth, reduced technical debt 