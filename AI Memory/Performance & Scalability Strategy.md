# Performance & Scalability Strategy: A Technical Guide

*This document outlines the application's architecture for handling performance-intensive tasks, centered on a full-backend implementation for model optimization.*

## 1. Core Problem / Use Case

The application's core value is running complex forecast model optimizations across large datasets. Performing these calculations on the browser's main thread caused the UI to freeze, creating a poor user experience. The central challenge is to execute these long-running, CPU-intensive tasks without blocking the UI, while providing a scalable and robust architecture.

---

## 2. How it Works: The Backend-Powered Architecture

To solve this, the application uses a full backend processing architecture. This is the definitive, enterprise-grade solution for handling large-scale optimization.

- **Description**: All optimization logic is handled by a dedicated backend server and a scalable worker service. The frontend's role is to submit jobs and display progress.
- **Architectural Flow**:
    1.  **Job Submission**: The frontend makes a single API call (`POST /api/jobs`) to the backend with the dataset that needs processing.
    2.  **Persistent Queue**: The backend creates jobs in a robust, persistent SQLite database queue. This ensures jobs are not lost on browser refresh.
    3.  **Backend Workers**: A separate Node.js worker process polls the database for pending jobs. It executes the optimization logic using the modular `ModelFactory` and `GridOptimizer`, then saves the result back to the database.
    4.  **Polling for Status**: The frontend periodically calls a status endpoint (`GET /api/jobs/status`) to update the UI with real-time progress.
    5.  **State Updates**: The `useBackendJobStatus` hook automatically processes completed jobs and updates the global application state.

---

## 3. Key Code Pointers

| Area                     | File / Component                     | Key Function / Class   | Purpose                                                                |
| ------------------------ | ------------------------------------ | ---------------------- | ---------------------------------------------------------------------- |
| **Backend Worker Logic** | `src/backend/worker.js`              | `processJob`           | Orchestrates the processing of optimization jobs in the backend.       |
| **Frontend Status Hook** | `src/hooks/useBackendJobStatus.ts`   | `useBackendJobStatus`  | Manages polling and state updates from the backend.                    |
| **Job Creation Hook**    | `src/hooks/useDataHandlers.ts`       | `handleDataUpload`     | Creates optimization jobs on the backend via API calls.                |
| **Model Architecture**   | `AI Memory/Forecasting Models & Architecture.md` | -            | The definitive guide to the modular model system.                      |
| **Core Optimizer**       | `src/backend/optimization/GridOptimizer.js` | `GridOptimizer`  | The engine that runs the grid search using the `ModelFactory`.         |
| **Model Factory**        | `src/backend/models/ModelFactory.js` | `ModelFactory`         | The central registry for creating all forecasting model instances.     |

---

## 4. "Gotchas" & Historical Context

- **The Main Thread Bottleneck**: The most critical historical fact is that running optimizations directly in the browser was the primary source of all performance complaints. This approach is now fully deprecated.
- **The Completed Backend Migration**: The backend infrastructure described above is fully implemented and operational. It uses real, sophisticated forecasting models to produce valid results. The previous notion of "simulated" backend results is obsolete.
- **UI State Synchronization**: A critical lesson learned was to have a single component (`ForecastPage`) fetch the backend status and pass it down as props. Independent fetching in child components led to race conditions and UI bugs. This is documented further in `UI State Management & Data Flow.md`.
- **Modularity for the Win**: A key architectural decision was to build a modular system for forecasting models (see `Forecasting Models & Architecture.md`). This allows for easy extension and maintenance of the core forecasting engine. 