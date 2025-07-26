# Forecasting Models & Architecture: A Technical Guide

*This document outlines the professional-grade, modular architecture for the backend forecasting engine. It details how models are structured, managed, and extended.*

## 1. Core Problem / Use Case

To provide robust and accurate forecasts, the application needs to support a wide variety of statistical models, from simple averages to complex algorithms like SARIMA. The challenge is to create a system that is:
- **Modular**: Easy to add, remove, or update individual models without impacting the rest of the system.
- **Consistent**: Ensures every model adheres to a standard interface for training, prediction, and validation.
- **Scalable**: Allows for sophisticated optimization techniques (like Grid Search) to run across all available models seamlessly.
- **Dynamic**: Frontend can discover available models from the backend without hardcoded lists.

---

## 2. How it Works: The Model-Factory Pattern

The architecture is built on three core components: the `BaseModel`, individual Model Implementations, and the `ModelFactory`.

### A. `BaseModel` (`src/backend/models/BaseModel.js`)
This is an abstract class that defines the contract for all forecasting models. Every model **must** extend `BaseModel` and implement its core methods:
- `train(data)`: Trains the model on historical data.
- `predict(periods)`: Forecasts a specified number of future periods.
- `validate(testData)`: Evaluates the model's accuracy against a validation dataset.

### B. Model Implementations (e.g., `src/backend/models/HoltWinters.js`)
Each forecasting algorithm is implemented in its own file as a class that extends `BaseModel`. This encapsulates all the mathematical logic for that specific model.

**Key Innovation**: Each model now exports static metadata including:
- `id`: Unique model identifier
- `displayName`: User-friendly name
- `defaultParameters`: Default parameter values
- `optimizationParameters`: Parameter ranges for grid search
- `isSeasonal`: Boolean indicating if model handles seasonality
- `enabled`: Boolean to enable/disable the model
- `description`: Detailed model description
- `category`: Model category for organization

### C. `ModelFactory` (`src/backend/models/ModelFactory.js`)
This is the central registry for all forecasting models.
- **Registration**: It imports all model classes and maps them to a string identifier (e.g., `'holt-winters'`).
- **Instantiation**: The rest of the application (like the `GridOptimizer`) never creates a model directly. Instead, it asks the `ModelFactory` to create an instance of a model by its identifier.
- **Decoupling**: This pattern decouples the optimization engine from the specific model implementations, making the entire system highly modular.
- **Dynamic Discovery**: The factory provides methods to get all available models and their metadata.

### D. Dynamic Model Discovery (`src/backend/models/ModelMetadata.js`)
A centralized module that exports `MODEL_METADATA` - an array of all model metadata for API consumption.

---

## 3. How to Add a New Model

Adding a new forecasting model is a simple, three-step process:

1.  **Create the Model File**: Create a new file in `src/backend/models/`. Implement your logic in a class that extends `BaseModel` and includes static metadata.
2.  **Register in Factory**: Open `src/backend/models/ModelFactory.js` and add your new model to the `registerAllModels` method.
3.  **Add to Metadata**: Open `src/backend/models/ModelMetadata.js` and add your model's metadata to the `ALL_MODEL_METADATA` array.

The system will automatically:
- Register the model in the factory
- Include it in the `/api/models` endpoint
- Make it available for grid search optimization
- Include it in export results with proper metadata

---

## 4. Key Code Pointers

| Area                        | File / Component                               | Key Function / Class | Purpose                                                                 |
| --------------------------- | ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| **Model Interface**         | `src/backend/models/BaseModel.js`              | `BaseModel`          | The abstract class that defines the standard model interface.           |
| **Model Registration**      | `src/backend/models/ModelFactory.js`           | `ModelFactory`       | Manages and creates all available model instances.                      |
| **Model Metadata**          | `src/backend/models/ModelMetadata.js`          | `MODEL_METADATA`     | Centralized metadata export for API consumption.                        |
| **Model Optimization**      | `src/backend/optimization/GridOptimizer.js`    | `GridOptimizer`      | Uses the ModelFactory to test different models and parameters.          |
| **Backend API**             | `src/backend/routes.js`                        | `GET /api/models`    | Exposes available models to frontend.                                   |
| **Frontend Integration**    | `src/utils/modelConfig.ts`                     | `fetchAvailableModels` | Fetches models from backend API.                                        |
| **Example Implementation**  | `src/backend/models/HoltLinearTrend.js`        | `HoltLinearTrend`    | A clear example of a model class implementation.                        |
| **External Library Wrapper**| `src/backend/models/ARIMA.js`                  | `ARIMAModel`         | Shows how to wrap an external library (`arima`) to fit the architecture.|
| **Seasonal Model Example**  | `src/backend/models/SARIMA.js`                 | `SARIMAModel`        | Shows how to implement a distinct seasonal model.                       |

---

## 5. Current Implemented Models

The backend currently supports a powerful suite of forecasting models:

| Model Name                      | Class Name                | Type                       | Key Features                                    | Category                    |
| ------------------------------- | ------------------------- | -------------------------- | ----------------------------------------------- | --------------------------- |
| **Simple Exponential Smoothing**| `SimpleExponentialSmoothing`| Built-in                   | Good for non-trending, non-seasonal data.       | Basic Models                |
| **Holt's Linear Trend**         | `HoltLinearTrend`         | Built-in                   | Handles data with a trend but no seasonality.   | Trend Models                |
| **Holt-Winters**                | `HoltWinters`             | Built-in                   | Handles data with both trend and seasonality.   | Advanced Seasonal Models    |
| **Moving Average**              | `MovingAverage`           | Built-in                   | Simple averaging over a sliding window.         | Basic Models                |
| **Seasonal Moving Average**     | `SeasonalMovingAverage`   | Built-in                   | Moving average on seasonally-adjusted data.     | Advanced Seasonal Models    |
| **Linear Trend**                | `LinearTrend`             | Built-in                   | Basic linear regression against time.           | Trend Models                |
| **Seasonal Naive**              | `SeasonalNaive`           | Built-in                   | Baseline model; repeats the last season.        | Advanced Seasonal Models    |
| **ARIMA**                       | `ARIMAModel`              | External Library (`arima`) | Powerful, flexible model for complex series.    | Advanced Trend Models       |
| **SARIMA**                      | `SARIMAModel`             | External Library (`arima`) | Seasonal ARIMA for seasonal time series.        | Advanced Seasonal Models    |

---

## 6. ARIMA vs SARIMA: Distinct Models

**Key Innovation**: ARIMA and SARIMA are now implemented as **separate, distinct models** for marketing clarity and user understanding.

### ARIMA Model (`src/backend/models/ARIMA.js`)
- **Purpose**: Non-seasonal time series forecasting
- **Parameters**: Focus on `p`, `d`, `q` (non-seasonal components)
- **Use Case**: Data with trend and autocorrelation but no seasonality
- **Category**: "Advanced Trend Models"
- **Description**: "Autoregressive Integrated Moving Average model for time series forecasting. Captures trend and autocorrelation patterns without seasonal components. Use SARIMA for seasonal data."

### SARIMA Model (`src/backend/models/SARIMA.js`)
- **Purpose**: Seasonal time series forecasting
- **Parameters**: Include `P`, `D`, `Q`, `s` (seasonal components)
- **Use Case**: Data with both trend and seasonal patterns
- **Category**: "Advanced Seasonal Models"
- **Description**: "Seasonal ARIMA model that captures both trend and seasonal patterns in time series data. Ideal for data with recurring seasonal cycles like monthly sales, quarterly reports, or weekly patterns."

### Benefits of Separation
- **Marketing Clarity**: Users can clearly choose between seasonal and non-seasonal models
- **Parameter Optimization**: Each model can optimize its specific parameter set
- **User Education**: Clear distinction helps users understand when to use each model
- **Export Clarity**: Export results clearly show which model type was used

---

## 7. Dynamic Frontend Integration

### Backend API (`GET /api/models`)
Returns the complete `MODEL_METADATA` array, providing:
- All available models with metadata
- Parameter information for UI generation
- Model categories and descriptions
- Seasonal vs non-seasonal flags

### Frontend Integration (`src/utils/modelConfig.ts`)
- **`fetchAvailableModels()`**: Fetches models from backend API
- **Deprecated**: `getDefaultModels()` - replaced with dynamic fetching
- **Automatic Discovery**: Frontend automatically discovers available models

### Hook Integration (`src/hooks/useModelParameters.ts`)
- Fetches models from backend on mount
- Provides models to components dynamically
- Handles loading states and error cases

---

## 8. Export System Integration

The optimization results export system (`/api/jobs/export-results`) now includes rich model metadata:
- **Model Display Names**: User-friendly names instead of technical IDs
- **Model Categories**: Organized grouping of models
- **Model Descriptions**: Detailed explanations of each model
- **Seasonal Flags**: Clear indication of seasonal vs non-seasonal models

This provides professional, contextual export data for analysis and reporting.

---

## 9. "Gotchas" & Historical Context

- **Model Separation**: ARIMA and SARIMA were initially combined but later separated for marketing clarity. This provides better user experience and clearer model selection.
- **Async Training**: ARIMA and SARIMA models use async training due to the underlying ARIMA library. The GridOptimizer was updated to support async training.
- **Parameter Sets**: SARIMA uses a predefined array of parameter sets rather than a grid to avoid memory issues with complex seasonal configurations.
- **Dynamic Discovery**: The frontend no longer has hardcoded model lists. All model information comes from the backend API, ensuring synchronization.
- **Metadata Consistency**: All models must export consistent metadata structure for proper API integration and export functionality.
- **Parameter Application**: When users click the "Grid" badge in model parameter controls, the sliders automatically update to show the optimized parameters found during grid search, with visual feedback and toast notifications.
- **Dataset-Specific Frequency**: All seasonal models (SARIMA, HoltWinters, SeasonalMovingAverage, SeasonalNaive) must use the frequency/seasonal period from the dataset metadata, not from global settings. The backend worker extracts frequency from the dataset file's summary and computes the seasonal period (weekly → 52, monthly → 12). This value is passed through job data to the GridOptimizer and ModelFactory. All global settings lookups for frequency/seasonalPeriod have been removed to prevent numerical errors from mismatched periods.

---

## 10. Interactive Parameter Controls

### Grid Badge Parameter Application
**Feature**: When users click the "Grid" badge in model parameter controls, the system automatically applies the optimized parameters found during grid search to the parameter sliders.

**Implementation**:
- **Visual Feedback**: Parameter values that match optimized values are highlighted with blue styling and an "Optimized" badge
- **Tooltip Guidance**: Grid badge shows tooltip explaining the feature when optimized parameters are available
- **Toast Notifications**: Users receive confirmation when optimized parameters are applied
- **Immediate Update**: Parameter sliders update instantly when grid badge is clicked

**User Experience**:
1. User runs grid search optimization on a model
2. Optimization completes with best parameters found
3. User clicks "Grid" badge in parameter controls
4. Sliders automatically update to show optimized values
5. Visual indicators show which parameters are optimized
6. Toast notification confirms the action

**Benefits**:
- **Discoverability**: Users can easily see and use the best parameters found
- **Transparency**: Clear visual indication of which parameters are optimized
- **Efficiency**: One-click application of optimized parameters
- **Learning**: Users can understand what parameters work best for their data

---

## 11. Modular Grid Search Implementation

### Overview
Implemented a modular approach where each model controls its own grid search behavior through static methods, ensuring all models (including non-optimizable ones) are always run and scored for fair comparison.

### BaseModel Static Methods
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

### Model-Specific Overrides
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

### Benefits
1. **Modular**: Each model controls its own grid search behavior
2. **Extensible**: New models can easily define custom grid search logic
3. **Consistent**: All models get scored and appear in UI/CSV
4. **Maintainable**: No hardcoded special cases scattered throughout codebase
5. **Flexible**: Models can opt out of grid search entirely if needed

---

## 12. Dataset-Specific Frequency Handling

### Critical Architecture Detail
**Problem**: Seasonal models were previously using hardcoded seasonal periods (e.g., SARIMA trying `s=12`, `s=4`, `s=7` regardless of actual data frequency), causing numerical errors like "function value exceeds the maximum double value" and "Matrix system does not have a unique solution".

**Solution**: All seasonal models now use dataset-specific frequency/seasonal periods:

### Implementation Flow
1. **Dataset Frequency Storage**: When CSV data is processed, the backend infers and stores the frequency (weekly, monthly, etc.) in the dataset's `summary.frequency` field.
2. **Worker Extraction**: The backend worker extracts frequency from the dataset file's summary when processing optimization jobs.
3. **Seasonal Period Computation**: Frequency is converted to seasonal period (weekly → 52, monthly → 12, quarterly → 4).
4. **Job Data Passing**: The seasonal period is passed through job data to the GridOptimizer.
5. **Model Creation**: The ModelFactory creates seasonal models with the correct seasonal period from the dataset, not from global settings.

### Key Code Points
- **Worker**: `src/backend/worker.js` → extracts frequency from dataset file summary
- **GridOptimizer**: `src/backend/optimization/GridOptimizer.js` → generates SARIMA parameters using dataset-specific period
- **ModelFactory**: `src/backend/models/ModelFactory.js` → requires seasonalPeriod for seasonal models
- **SARIMA Model**: `src/backend/models/SARIMA.js` → validates sufficient data for seasonal period

### Benefits
- **Prevents Numerical Errors**: Correct seasonal periods prevent ARIMA library failures
- **Data-Driven**: Seasonal periods match actual data characteristics
- **Robust Validation**: Models check for sufficient data (at least 2 full seasons)
- **Clear Error Messages**: Descriptive errors when seasonal models can't be used

### Frequency Mapping
- **Weekly**: 52 periods per year
- **Monthly**: 12 periods per year  
- **Quarterly**: 4 periods per year
- **Daily**: 365 periods per year (if applicable)

This ensures that seasonal models like SARIMA use the correct seasonal period based on the actual data frequency, preventing the numerical errors that occurred when using hardcoded periods that didn't match the data.

---

## 13. Enhanced UI Components (Recently Implemented)

### Model Status Table
- **Comprehensive Display**: Shows all model/method combinations with current status
- **Visual Enhancements**:
  - Row striping for improved readability
  - Status icons for different job states (pending, running, completed, failed)
  - Progress bars for individual optimization progress
  - Evenly distributed columns with proper spacing
- **Status Alignment**: Status icon and text aligned on single line using flex containers
- **Action Buttons**: Positioned below table with proper spacing to avoid overlap

### Optimization Queue Interface
- **Summary Statistics**: Overview cards showing active, completed, failed, and total jobs
- **Tabbed Interface**: Separate tabs for active, completed, and failed optimizations
- **Real-time Updates**: Automatic refresh of optimization status
- **Batch Management**: Track optimization progress by batch ID
- **Priority System**: Visual indicators for job priority levels

### Model Parameter Controls
- **Method Selection**: Choose between AI, Grid Search, or Manual optimization
- **Parameter Sliders**: Interactive controls for manual parameter adjustment
- **Status Display**: Real-time feedback on parameter changes and optimization status
- **Validation**: Immediate feedback on parameter validity

## 14. Optimization Methods

### Grid Search
- **Comprehensive**: Tests all parameter combinations within defined ranges
- **Configurable**: Parameter ranges can be adjusted per model
- **Efficient**: Optimized to minimize redundant calculations

### AI-Enhanced Optimization
- **Intelligent**: Uses machine learning to guide parameter search
- **Adaptive**: Learns from previous optimization results
- **Efficient**: Reduces search space while maintaining quality

### Manual Mode
- **Direct Control**: Users can set parameters directly
- **Real-time**: Immediate parameter application
- **Validation**: Built-in parameter range checking

## 15. Data Requirements

Each model has specific data requirements:

- **Minimum Observations**: Required data points for reliable forecasting
- **Seasonal Period**: Required for seasonal models (extracted from data frequency)
- **Data Quality**: Validation for missing values and outliers

## 16. Model Selection

### Automatic Selection
- **Performance-Based**: Models are ranked by accuracy metrics
- **Data-Driven**: Selection considers data characteristics
- **Configurable**: Business rules can influence selection

### Manual Override
- **User Control**: Users can override automatic selections
- **Expert Mode**: Advanced users can fine-tune selections
- **Persistence**: Selections are saved and restored

## 17. Performance Metrics

### Accuracy Measures
- **MAPE**: Mean Absolute Percentage Error
- **RMSE**: Root Mean Square Error
- **MAE**: Mean Absolute Error
- **Composite Score**: Weighted combination of multiple metrics

### Model Comparison
- **Side-by-Side**: Visual comparison of model performance
- **Statistical Tests**: Formal comparison of model accuracy
- **Business Context**: Consideration of business requirements

## 18. Integration Points

### Backend Services
- **ForecastGenerator**: Orchestrates model execution
- **GridOptimizer**: Manages parameter optimization
- **ModelFactory**: Creates and configures models
- **Worker System**: Handles asynchronous optimization

### Frontend Components
- **ForecastEngine**: Main forecasting interface
- **ModelParameterPanel**: Model selection and configuration
- **OptimizationQueue**: Real-time optimization monitoring
- **ForecastResults**: Results display and comparison

## 19. Future Enhancements

### Planned Features
- **Ensemble Methods**: Combine multiple models for improved accuracy
- **Custom Models**: User-defined forecasting algorithms
- **Advanced Validation**: Cross-validation and backtesting
- **Model Persistence**: Save and reuse optimized models

### Performance Improvements
- **Parallel Processing**: Concurrent model optimization
- **Caching**: Cache optimization results for faster access
- **Incremental Updates**: Update models with new data efficiently

---

**For related documentation, see:**