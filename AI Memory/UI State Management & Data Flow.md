# UI State Management & Data Flow: A Technical Guide

*This document outlines the application's core pattern for managing UI state using Zustand stores, ensuring consistent data flow and state synchronization across components.*

## 1. Core Problem / Use Case

In a complex application with multiple, asynchronous data sources (like a backend job queue), it's easy for different UI components to fall out of sync. For example, a button might show a "Processing..." state while a popup window shows that the queue is empty. These inconsistencies lead to a confusing and buggy user experience.

The central challenge is to create a predictable and robust data flow that ensures all parts of the UI are always rendering from the same, up-to-date state.

---

## 2. How it Works: The Zustand Store Architecture

The application has evolved from a "Single Source of Truth" pattern to a **Zustand-based store architecture** that provides centralized state management with automatic reactivity and persistence.

### A. Store Architecture Overview

The application uses multiple Zustand stores, each responsible for a specific domain:

1. **`useModelUIStore`** (`src/store/optimizationStore.ts`): Manages model parameters, method selection, and optimization state
2. **`useSKUStore`** (`src/store/skuStore.ts`): Manages selected SKU state with persistence
3. **`useForecastResultsStore`** (`src/store/forecastResultsStore.ts`): Manages forecast results and pending operations
4. **`useOptimizationStore`** (`src/store/optimizationStore.ts`): Legacy optimization state (partially used)

### B. Store Integration Pattern

**Store Usage in Components**:
- Components subscribe to specific store slices using Zustand's selector pattern
- State updates automatically trigger re-renders in subscribed components
- Stores provide both state and actions for state mutations

**Example Store Usage**:
```typescript
// Subscribe to specific state
const selectedSKU = useSKUStore(state => state.selectedSKU);
const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);

// Subscribe to model UI state
const modelUI = useModelUIStore(state => 
  state.getModelUIState(filePath, uuid, selectedSKU, model.id)
);
```

### C. Benefits of Zustand Architecture

- **Automatic Reactivity**: Components automatically re-render when subscribed state changes
- **Centralized State**: All related state is co-located in domain-specific stores
- **Persistence**: Built-in persistence for critical state (e.g., selected SKU)
- **Performance**: Selective subscriptions prevent unnecessary re-renders
- **Type Safety**: Full TypeScript support with proper type inference
- **Debugging**: Built-in debugging tools and state inspection

---

## 3. Key Store Implementations

### A. Model UI Store (`useModelUIStore`)

**Purpose**: Manages model parameters, method selection (Manual/Grid/AI), and optimization state for each SKU/model combination.

**State Structure**:
```typescript
modelUIState: {
  [filePath: string]: {
    [uuid: string]: {
      [sku: string]: {
        [modelId: string]: {
          manual?: { parameters: {}, compositeScore?: number, isWinner?: boolean },
          grid?: { parameters: {}, compositeScore?: number, isWinner?: boolean },
          ai?: { parameters: {}, compositeScore?: number, isWinner?: boolean },
          selectedMethod?: 'manual' | 'grid' | 'ai'
        }
      }
    }
  }
}
```

**Key Actions**:
- `setParameters()`: Update parameters for a specific model/method
- `setSelectedMethod()`: Change the active method for a model
- `getModelUIState()`: Retrieve current state for a model
- `resetModelUIState()`: Clear all model state
- `cleanupDuplicateDatasets()`: Remove duplicate dataset entries

**Usage Examples**:
```typescript
// In ModelCard.tsx
const modelUI = useModelUIStore(state => 
  state.getModelUIState(filePath, uuid, selectedSKU, model.id)
);

// In ParameterControlContainer.tsx
const setParameters = useModelUIStore(state => state.setParameters);
const setSelectedMethod = useModelUIStore(state => state.setSelectedMethod);
```

### B. SKU Store (`useSKUStore`)

**Purpose**: Manages the currently selected SKU with automatic persistence.

**State Structure**:
```typescript
{
  selectedSKU: string;
  setSelectedSKU: (sku: string) => void;
}
```

**Features**:
- **Persistence**: Uses Zustand's `persist` middleware to save to localStorage
- **Global Access**: Any component can access and modify the selected SKU
- **Automatic Sync**: Changes immediately reflect across all components

**Usage Examples**:
```typescript
// In any component
const selectedSKU = useSKUStore(state => state.selectedSKU);
const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);
```

### C. Forecast Results Store (`useForecastResultsStore`)

**Purpose**: Manages forecast results, pending operations, and optimization completion state.

**State Structure**:
```typescript
{
  results: { [filePath]: { [sku]: { [modelId]: { [method]: ForecastResult } } } },
  pending: PendingForecast[],
  optimizationCompleted: { [filePath]: { [sku]: boolean } }
}
```

**Key Actions**:
- `setResult()`: Store forecast results for a specific model/method
- `getResult()`: Retrieve forecast results
- `addPending()`: Track pending forecast operations
- `setOptimizationCompleted()`: Mark optimization as complete

---

## 4. Store Integration with Backend

### A. Backend State Synchronization

**Job Status Integration**:
- Backend job status is fetched via `useBackendJobStatus` hook
- Job completion triggers updates to Zustand stores
- Store state reflects the current backend state

**Optimization Results Flow**:
1. Backend completes optimization job
2. `useBestResultsMapping` hook processes results
3. Results are stored in `useModelUIStore` and `useForecastResultsStore`
4. UI components automatically update via store subscriptions

### B. Data Flow Pattern

```
Backend API → useBackendJobStatus → Zustand Stores → UI Components
     ↓              ↓                    ↓              ↓
  Job Status    Process Results    Update State    Re-render
```

---

## 5. Component Integration Patterns

### A. Store Subscription Pattern

**Selective Subscriptions**:
```typescript
// Subscribe only to needed state
const selectedSKU = useSKUStore(state => state.selectedSKU);
const modelUI = useModelUIStore(state => 
  state.getModelUIState(filePath, uuid, selectedSKU, model.id)
);
```

**Action Access**:
```typescript
// Get actions from store
const setSelectedSKU = useSKUStore(state => state.setSelectedSKU);
const setParameters = useModelUIStore(state => state.setParameters);
```

### B. State Updates

**Direct Store Updates**:
```typescript
// Update state directly
setSelectedSKU(newSKU);
setParameters(filePath, uuid, sku, modelId, method, newParams);
```

**Batch Updates**:
```typescript
// Multiple updates in sequence
setParameters(filePath, uuid, sku, modelId, 'grid', gridParams);
setParameters(filePath, uuid, sku, modelId, 'ai', aiParams);
setSelectedMethod(filePath, uuid, sku, modelId, 'manual');
```

---

## 6. Debugging and Development Tools

### A. Zustand Debugger

**Built-in Debug Panel**:
- Available in settings dialog under "Debug" tab
- Shows real-time state for all stores
- Provides clear/reset functionality for each store
- Helps identify state inconsistencies

**Store Inspection**:
```typescript
// Access store state directly
const state = useModelUIStore.getState();
console.log('Current model UI state:', state.modelUIState);
```

### B. State Validation

**File Path Validation**:
- Stores validate file paths to prevent invalid entries
- Automatic cleanup of duplicate dataset entries
- Warning logs for invalid state updates

**State Consistency**:
- Stores maintain referential integrity
- Automatic cleanup of old entries (limit to 5 filePaths)
- Validation of required parameters

---

## 7. Migration from Previous Architecture

### A. Evolution from Single Source of Truth

**Previous Pattern**:
- Page-level components fetched and passed state as props
- Complex prop drilling through component hierarchy
- Manual state synchronization between components

**Current Zustand Pattern**:
- Components subscribe directly to store state
- Automatic reactivity and synchronization
- Reduced prop drilling and component coupling

### B. Benefits of Migration

- **Simplified Components**: Components focus on rendering, not state management
- **Better Performance**: Selective subscriptions prevent unnecessary re-renders
- **Easier Testing**: Stores can be tested independently
- **Improved Debugging**: Centralized state with built-in debugging tools

---

## 8. "Gotchas" & Historical Context

- **Store Subscription**: Always use selective subscriptions to prevent unnecessary re-renders. Don't subscribe to entire store objects.
- **State Updates**: Use store actions instead of directly mutating state. This ensures proper reactivity and debugging.
- **File Path Validation**: Stores validate file paths to prevent invalid entries. Always use proper file path format.
- **Cleanup**: Stores automatically clean up old entries to prevent memory leaks. Don't manually manage cleanup.
- **Persistence**: Only critical state (like selected SKU) is persisted. Other state is ephemeral and resets on page reload.
- **Store Coupling**: Stores are designed to be independent. Avoid cross-store dependencies to maintain modularity.

---

## 9. Future Evolution

### A. Planned Enhancements

**Store Consolidation**:
- Consider consolidating related stores for better organization
- Implement store composition patterns for complex state
- Add middleware for cross-cutting concerns (logging, analytics)

**Performance Optimization**:
- Implement store memoization for expensive computations
- Add store-level caching for frequently accessed data
- Optimize subscription patterns for large state trees

**Advanced Features**:
- Add store-level undo/redo functionality
- Implement store persistence for more state types
- Add store-level validation and error handling

---

**For related documentation, see:**
- `Forecast Methods & Parameter Persisten.md` - Parameter persistence implementation
- `Queue Processing & Job Management.md` - Backend job system integration
- `Performance & Scalability Strategy.md` - Backend architecture overview