# Forecasting Models & Architecture: A Technical Guide

*This document outlines the professional-grade, modular architecture for the backend forecasting engine. It details how models are structured, managed, and extended.*

## 1. Core Problem / Use Case

To provide robust and accurate forecasts, the application needs to support a wide variety of statistical models, from simple averages to complex algorithms like SARIMA. The challenge is to create a system that is:
- **Modular**: Easy to add, remove, or update individual models without impacting the rest of the system.
- **Consistent**: Ensures every model adheres to a standard interface for training, prediction, and validation.
- **Scalable**: Allows for sophisticated optimization techniques (like Grid Search) to run across all available models seamlessly.

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

### C. `ModelFactory` (`src/backend/models/ModelFactory.js`)
This is the central registry for all forecasting models.
- **Registration**: It imports all model classes and maps them to a string identifier (e.g., `'holt-winters'`).
- **Instantiation**: The rest of the application (like the `GridOptimizer`) never creates a model directly. Instead, it asks the `ModelFactory` to create an instance of a model by its identifier.
- **Decoupling**: This pattern decouples the optimization engine from the specific model implementations, making the entire system highly modular.

---

## 3. How to Add a New Model

Adding a new forecasting model is a simple, three-step process:

1.  **Create the Model File**: Create a new file in `src/backend/models/`. Implement your logic in a class that extends `BaseModel`.
2.  **Register in Factory**: Open `src/backend/models/ModelFactory.js` and add your new model to the `registerDefaultModels` method.
3.  **Add to Grid Search**: Open `src/backend/optimization/GridOptimizer.js` and add a parameter grid for your new model in the `getParameterGrids` method.

---

## 4. Key Code Pointers

| Area                        | File / Component                               | Key Function / Class | Purpose                                                                 |
| --------------------------- | ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| **Model Interface**         | `src/backend/models/BaseModel.js`              | `BaseModel`          | The abstract class that defines the standard model interface.           |
| **Model Registration**      | `src/backend/models/ModelFactory.js`           | `ModelFactory`       | Manages and creates all available model instances.                      |
| **Model Optimization**      | `src/backend/optimization/GridOptimizer.js`    | `GridOptimizer`      | Uses the ModelFactory to test different models and parameters.          |
| **Example Implementation**  | `src/backend/models/HoltLinearTrend.js`        | `HoltLinearTrend`    | A clear example of a model class implementation.                        |
| **External Library Wrapper**| `src/backend/models/ARIMA.js`                  | `ARIMAModel`         | Shows how to wrap an external library (`arima`) to fit the architecture.|

---

## 5. Current Implemented Models

The backend currently supports a powerful suite of forecasting models:

| Model Name                      | Class Name                | Type                       | Key Features                                    |
| ------------------------------- | ------------------------- | -------------------------- | ----------------------------------------------- |
| **Simple Exponential Smoothing**| `SimpleExponentialSmoothing`| Built-in                   | Good for non-trending, non-seasonal data.       |
| **Holt's Linear Trend**         | `HoltLinearTrend`         | Built-in                   | Handles data with a trend but no seasonality.   |
| **Holt-Winters**                | `HoltWinters`             | Built-in                   | Handles data with both trend and seasonality.   |
| **Moving Average**              | `MovingAverage`           | Built-in                   | Simple averaging over a sliding window.         |
| **Seasonal Moving Average**     | `SeasonalMovingAverage`   | Built-in                   | Moving average on seasonally-adjusted data.     |
| **Linear Trend**                | `LinearTrend`             | Built-in                   | Basic linear regression against time.           |
| **Seasonal Naive**              | `SeasonalNaive`           | Built-in                   | Baseline model; repeats the last season.        |
| **ARIMA / SARIMA**              | `ARIMAModel`              | External Library (`arima`) | Powerful, flexible model for complex series.    |

</rewritten_file> 