# Frontend Update Plan for New Schema

## 🎯 Overview
After updating the database schema, the frontend needs several updates to work with the new structure.

## 📋 Required Updates

### 1. **Settings System Updates**

#### **A. Fix GlobalSettings Interface**
**File:** `src/types/globalSettings.ts`
**Issue:** Missing `accuracyWeight` field
**Fix:** Add the missing field to the interface

#### **B. Update Settings Provider**
**File:** `src/services/settingsProvider.ts`
**Issues:** 
- Backend API calls need to include `company_id` and `user_id`
- API endpoints need to be updated for new schema

#### **C. Fix useGlobalSettings Hook**
**File:** `src/hooks/useGlobalSettings.ts`
**Issues:**
- Missing `accuracyWeight` state and setters
- Broken references to `accuracyWeight`

### 2. **API Endpoint Updates**

#### **A. Settings API**
**Current:** `/api/settings` (GET/POST)
**Needs:** Update to use `user_settings` table with `company_id` and `user_id`

#### **B. Optimization Status API**
**Current:** `/api/optimizations/status`
**Status:** ✅ Already updated in backend
**Frontend:** Should work as-is

#### **C. Job Status API**
**Current:** `/api/jobs/status`
**Status:** ✅ Already updated in backend
**Frontend:** Should work as-is

### 3. **Component Fixes**

#### **A. ForecastSettings.tsx**
**Issues:**
- Broken `accuracyWeight` references (shows as `Weight`)
- Missing state management for accuracy weight

#### **B. OptimizationResultsExporter.tsx**
**Issues:**
- Broken `accuracyWeight` reference (shows as `Weight`)

#### **C. ModelComparisonReasoning.tsx**
**Issues:**
- Broken `accuracyWeight` reference (shows as `Weight`)

#### **D. ParameterStatusDisplay.tsx**
**Issues:**
- Broken accuracy display (shows as `..toFixed(1)`)

#### **E. OptimizationLogger.tsx**
**Issues:**
- Broken accuracy display (shows as `step..toFixed(1)`)

### 4. **Type Definitions**

#### **A. GlobalSettings Type**
**File:** `src/types/globalSettings.ts`
**Needs:** Add missing `accuracyWeight` field

## 🚀 Implementation Priority

### **Phase 1: Critical Fixes (Do First)**
1. Fix `GlobalSettings` interface
2. Fix `useGlobalSettings` hook
3. Fix `ForecastSettings.tsx` component
4. Update settings provider API calls

### **Phase 2: Component Fixes**
1. Fix `OptimizationResultsExporter.tsx`
2. Fix `ModelComparisonReasoning.tsx`
3. Fix `ParameterStatusDisplay.tsx`
4. Fix `OptimizationLogger.tsx`

### **Phase 3: Testing & Validation**
1. Test settings persistence
2. Test optimization queue display
3. Test forecast generation
4. Test accuracy weight functionality

## 🔧 Specific Code Changes Needed

### **1. Update GlobalSettings Interface**
```typescript
// src/types/globalSettings.ts
export interface GlobalSettings {
  // ... existing fields ...
  accuracyWeight: number; // Add this missing field
}
```

### **2. Fix useGlobalSettings Hook**
```typescript
// src/hooks/useGlobalSettings.ts
// Add missing state and setters for accuracyWeight
const [accuracyWeight, setAccuracyWeightState] = useState<number>(DEFAULT_SETTINGS.accuracyWeight);
```

### **3. Update Settings Provider**
```typescript
// src/services/settingsProvider.ts
// Update API calls to include company_id and user_id
const response = await fetch('/api/settings?company_id=1&user_id=1');
```

### **4. Fix Component References**
```typescript
// Fix all instances of 'Weight' to 'accuracyWeight'
// Fix all instances of '..toFixed(1)' to proper accuracy references
```

## ⚠️ Important Notes

1. **Don't remove accuracy references** - Keep them as requested
2. **Test each component** after fixing
3. **Verify settings persistence** works correctly
4. **Check optimization queue** displays properly
5. **Ensure forecast generation** still works

## 🎯 Success Criteria

After updates, the frontend should:
- ✅ Load and save settings correctly
- ✅ Display optimization queue with jobs
- ✅ Show accuracy weights in settings
- ✅ Generate forecasts without errors
- ✅ Display all accuracy metrics properly 