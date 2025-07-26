# Forecast Wizard Wireframe

## Overview
The Forecast step will use a wizard/sub-step approach with 2 focused sub-steps, keeping export functionality separate.

## Sub-Step Structure

### Sub-Step 1: Review & Tune
**Purpose:** User reviews optimization results and fine-tunes parameters before forecasting.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Forecast Step - Review & Tune                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [◀ Back] [Review & Tune] [Finalize Forecast] [Next ▶]      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Model Performance Summary                               │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │ │
│ │ │ Model A     │ │ Model B     │ │ Model C     │        │ │
│ │ │ Score: 0.85 │ │ Score: 0.92 │ │ Score: 0.78 │        │ │
│ │ │ [Tune]      │ │ [Tune]      │ │ [Tune]      │        │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Diagnostic Charts                                       │ │
│ │ [Model A] [Model B] [Model C]                           │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │                                                     │ │ │
│ │ │ Chart showing model performance, residuals, etc.    │ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Parameter Tuning                                        │ │
│ │ Model: [Dropdown] Parameter: [Dropdown]                 │ │
│ │                                                         │ │
│ │ [Slider/Input controls for selected parameter]          │ │
│ │                                                         │ │
│ │ [Regenerate Optimization] [Apply Changes]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Model performance cards with quick tune buttons
- Tabbed diagnostic charts per model
- Parameter tuning panel with regeneration capability
- Clear navigation between sub-steps

### Sub-Step 2: Finalize Forecast
**Purpose:** User finalizes the forecast with manual adjustments and AI-assisted tuning.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Forecast Step - Finalize Forecast                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [◀ Back] [Review & Tune] [Finalize Forecast] [Next ▶]      │ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Main Forecast Chart                                     │ │
│ │ [Zoom] [Pan] [Reset] [Export Chart]                     │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │                                                     │ │ │
│ │ │ Interactive chart with draggable forecast points    │ │ │
│ │ │ (historical data + forecast line)                   │ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Manual Adjustments                                      │ │
│ │ [Select Points] [Drag to Adjust] [Reset Changes]        │ │
│ │                                                         │ │
│ │ Selected Period: [Date Range Picker]                    │ │
│ │ Adjustment: [Input] [Apply]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AI-Assisted Tuning                                      │ │
│ │ [Natural language input box]                            │ │
│ │ "Set sales to zero for July-December"                   │ │
│ │                                                         │ │
│ │ [Apply AI Suggestion] [Clear]                           │ │
│ │                                                         │ │
│ │ Recent Suggestions:                                     │ │
│ │ • "Reduce forecast by 10% for Q4" [Undo]               │ │
│ │ • "Smooth out seasonal peaks" [Undo]                    │ │
│ │ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Forecast Summary                                        │ │
│ │ Total Forecast: [Value] | Confidence: [Range]           │ │
│ │ [View Details] [Finalize Forecast]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Interactive main forecast chart with draggable points
- Manual adjustment tools with period selection
- AI-assisted tuning with natural language input
- Forecast summary with confidence metrics
- Finalization button to complete the process

## Navigation & State Management

### Wizard State
```typescript
interface ForecastWizardState {
  currentStep: 'review' | 'finalize';
  optimizationResults: OptimizationResult[];
  selectedModel: string;
  parameterAdjustments: ParameterAdjustment[];
  manualAdjustments: ManualAdjustment[];
  aiSuggestions: AISuggestion[];
  finalizedForecast: ForecastData;
}
```

### Navigation Flow
1. **Entry Point:** User clicks "Forecast" step → lands on "Review & Tune"
2. **Review & Tune:** User can tune parameters, regenerate optimizations
3. **Finalize:** User can make manual adjustments and use AI assistance
4. **Completion:** User clicks "Finalize Forecast" → returns to main workflow

### Integration Points
- **Data Source:** Optimization results from previous step
- **State Persistence:** Zustand store for wizard state
- **Backend Integration:** Parameter tuning triggers new optimization jobs
- **AI Integration:** Natural language processing for forecast adjustments

## UI Components Needed

### New Components
- `ForecastWizard.tsx` - Main wizard container
- `ReviewTuneStep.tsx` - Sub-step 1 component
- `FinalizeStep.tsx` - Sub-step 2 component
- `ModelPerformanceCards.tsx` - Model summary cards
- `DiagnosticCharts.tsx` - Tabbed chart component
- `ParameterTuningPanel.tsx` - Parameter adjustment controls
- `InteractiveForecastChart.tsx` - Draggable forecast chart
- `ManualAdjustmentTools.tsx` - Manual adjustment controls
- `AITuningPanel.tsx` - AI-assisted tuning interface
- `ForecastSummary.tsx` - Final forecast summary

### Existing Components to Reuse
- `ForecastChart.tsx` - Base chart functionality
- `ParameterControl.tsx` - Parameter input controls
- `ModelCard.tsx` - Model display components
- UI components from `ui/` directory

## Responsive Design Considerations
- **Desktop:** Full layout with side-by-side panels
- **Tablet:** Stacked layout with collapsible sections
- **Mobile:** Single-column layout with tabbed navigation

## Accessibility Features
- Keyboard navigation between sub-steps
- Screen reader support for chart interactions
- High contrast mode support
- Focus management for interactive elements 

## Overview
The Forecast step will use a wizard/sub-step approach with 2 focused sub-steps, keeping export functionality separate.

## Sub-Step Structure

### Sub-Step 1: Review & Tune
**Purpose:** User reviews optimization results and fine-tunes parameters before forecasting.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Forecast Step - Review & Tune                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [◀ Back] [Review & Tune] [Finalize Forecast] [Next ▶]      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Model Performance Summary                               │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │ │
│ │ │ Model A     │ │ Model B     │ │ Model C     │        │ │
│ │ │ Score: 0.85 │ │ Score: 0.92 │ │ Score: 0.78 │        │ │
│ │ │ [Tune]      │ │ [Tune]      │ │ [Tune]      │        │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Diagnostic Charts                                       │ │
│ │ [Model A] [Model B] [Model C]                           │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │                                                     │ │ │
│ │ │ Chart showing model performance, residuals, etc.    │ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Parameter Tuning                                        │ │
│ │ Model: [Dropdown] Parameter: [Dropdown]                 │ │
│ │                                                         │ │
│ │ [Slider/Input controls for selected parameter]          │ │
│ │                                                         │ │
│ │ [Regenerate Optimization] [Apply Changes]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Model performance cards with quick tune buttons
- Tabbed diagnostic charts per model
- Parameter tuning panel with regeneration capability
- Clear navigation between sub-steps

### Sub-Step 2: Finalize Forecast
**Purpose:** User finalizes the forecast with manual adjustments and AI-assisted tuning.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Forecast Step - Finalize Forecast                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [◀ Back] [Review & Tune] [Finalize Forecast] [Next ▶]      │ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Main Forecast Chart                                     │ │
│ │ [Zoom] [Pan] [Reset] [Export Chart]                     │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │                                                     │ │ │
│ │ │ Interactive chart with draggable forecast points    │ │ │
│ │ │ (historical data + forecast line)                   │ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Manual Adjustments                                      │ │
│ │ [Select Points] [Drag to Adjust] [Reset Changes]        │ │
│ │                                                         │ │
│ │ Selected Period: [Date Range Picker]                    │ │
│ │ Adjustment: [Input] [Apply]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AI-Assisted Tuning                                      │ │
│ │ [Natural language input box]                            │ │
│ │ "Set sales to zero for July-December"                   │ │
│ │                                                         │ │
│ │ [Apply AI Suggestion] [Clear]                           │ │
│ │                                                         │ │
│ │ Recent Suggestions:                                     │ │
│ │ • "Reduce forecast by 10% for Q4" [Undo]               │ │
│ │ • "Smooth out seasonal peaks" [Undo]                    │ │
│ │ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Forecast Summary                                        │ │
│ │ Total Forecast: [Value] | Confidence: [Range]           │ │
│ │ [View Details] [Finalize Forecast]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Interactive main forecast chart with draggable points
- Manual adjustment tools with period selection
- AI-assisted tuning with natural language input
- Forecast summary with confidence metrics
- Finalization button to complete the process

## Navigation & State Management

### Wizard State
```typescript
interface ForecastWizardState {
  currentStep: 'review' | 'finalize';
  optimizationResults: OptimizationResult[];
  selectedModel: string;
  parameterAdjustments: ParameterAdjustment[];
  manualAdjustments: ManualAdjustment[];
  aiSuggestions: AISuggestion[];
  finalizedForecast: ForecastData;
}
```

### Navigation Flow
1. **Entry Point:** User clicks "Forecast" step → lands on "Review & Tune"
2. **Review & Tune:** User can tune parameters, regenerate optimizations
3. **Finalize:** User can make manual adjustments and use AI assistance
4. **Completion:** User clicks "Finalize Forecast" → returns to main workflow

### Integration Points
- **Data Source:** Optimization results from previous step
- **State Persistence:** Zustand store for wizard state
- **Backend Integration:** Parameter tuning triggers new optimization jobs
- **AI Integration:** Natural language processing for forecast adjustments

## UI Components Needed

### New Components
- `ForecastWizard.tsx` - Main wizard container
- `ReviewTuneStep.tsx` - Sub-step 1 component
- `FinalizeStep.tsx` - Sub-step 2 component
- `ModelPerformanceCards.tsx` - Model summary cards
- `DiagnosticCharts.tsx` - Tabbed chart component
- `ParameterTuningPanel.tsx` - Parameter adjustment controls
- `InteractiveForecastChart.tsx` - Draggable forecast chart
- `ManualAdjustmentTools.tsx` - Manual adjustment controls
- `AITuningPanel.tsx` - AI-assisted tuning interface
- `ForecastSummary.tsx` - Final forecast summary

### Existing Components to Reuse
- `ForecastChart.tsx` - Base chart functionality
- `ParameterControl.tsx` - Parameter input controls
- `ModelCard.tsx` - Model display components
- UI components from `ui/` directory

## Responsive Design Considerations
- **Desktop:** Full layout with side-by-side panels
- **Tablet:** Stacked layout with collapsible sections
- **Mobile:** Single-column layout with tabbed navigation

## Accessibility Features
- Keyboard navigation between sub-steps
- Screen reader support for chart interactions
- High contrast mode support
- Focus management for interactive elements 