# Performance & Scalability Strategy: A Technical Guide

*This document outlines the application's strategy for handling performance-intensive tasks like model optimization, focusing on the evolution from main-thread execution to Web Workers and a full-backend implementation.*

## 1. Core Problem / Use Case

The application's core value is running complex forecast model optimizations (e.g., grid search) across potentially thousands of SKUs. When these calculations were performed directly on the browser's main thread, the User Interface (UI) would freeze, creating a poor user experience.

The central challenge is to execute these long-running, CPU-intensive tasks without blocking the UI, while providing a scalable architecture that can handle growing datasets.

---

## 2. How it Works (Architectural Evolution)

The architecture has evolved to address this challenge in phases.

### Phase 0: Main-Thread Processing (Historical)

- **Description**: Initially, all optimization jobs were processed sequentially by the `useOptimizationQueue.ts` hook directly on the main thread.
- **Problem**: This caused the UI to freeze during any long-running optimization task.
- **Safeguards**: To mitigate this, temporary limits were put in place, such as `MAX_SKUS_FOR_OPTIMIZATION` and caps on grid search iterations. These limits have since been removed to support full portfolio optimization.

### Phase 1: Web Worker Integration (Historical - Partially Implemented)

- **Description**: This architecture offloads the optimization work from the main thread to a background thread using a Web Worker.
- **Architectural Flow**:
    1. The `useOptimizationQueue.ts` hook receives a job.
    2. Instead of running the calculation itself, it calls the `useWorkerManager.ts` hook.
    3. The worker manager dispatches the job (e.g., `runGridOptimization`) to the `comprehensiveWorker.ts` file.
    4. The worker runs the heavy computation in the background. The UI remains fully responsive.
    5. When the worker is finished, it posts a message back with the result.
    6. The `useWorkerManager` receives the result and resolves the promise, allowing `useOptimizationQueue` to update the application state.
- **Status**: **Partially implemented.** The worker manager and the worker file exist, but were never fully integrated into the optimization queue.

### Phase 2: Full Backend Processing (Current Implementation)

This is the current, enterprise-grade solution for handling very large-scale processing.

- **Description**: All optimization logic is moved from the client to a dedicated backend server and a scalable worker service.
- **Architectural Flow**:
    1. **Job Submission**: The frontend makes a single API call (`POST /api/jobs`) to the backend with the dataset that needs processing.
    2. **Persistent Queue**: The backend creates jobs in a robust, persistent SQLite database queue.
    3. **Backend Workers**: A separate Node.js worker service polls the database for pending jobs. It executes the optimization logic and saves the result back to the database.
    4. **Polling for Status**: The frontend periodically calls a status endpoint (`GET /api/jobs/status`) to update the UI with the progress.
    5. **Real-time Updates**: The `useBackendJobStatus` hook automatically processes completed jobs and updates the global state.

### Phase 3: Full Backend Persistence & User Accounts (Planned)

This is the next evolution of the application to become a true multi-user, professional-grade service.

- **Description**: Migrates all user-specific data from the client's browser to a central backend database. This introduces a multi-tenant architecture with Organizations, User Roles, and collaborative data management.
- **Architectural Flow**:
    1. **User Authentication**: A user will register and log in via the backend API. The frontend will manage a session (e.g., using a JWT).
    2. **Centralized, Collaborative Data Storage**:
        - All core data (datasets, forecasts, etc.) will be stored in a backend database and linked to an `organizationId`, not just a `userId`.
        - This allows multiple users from the same organization to access and collaborate on the same data, according to their roles.
        - This explicitly includes both the **original uploaded data** and the **cleaned data**, which allows users to incrementally add more sales data over time.
    3. **API-Driven Data Management**:
        - The frontend will be refactored to fetch all data from protected backend API endpoints (e.g., `GET /api/datasets/:id`).
        - The backend middleware will be updated to check not only if a user is authenticated, but also if their organization owns the requested data and if their role permits the requested action.
    4. **Benefit**: This provides true data persistence, security, scalability, and a collaborative environment for teams.

---

## 3. Key Code Pointers

| Area                     | File / Component                     | Key Function / Hook   | Purpose                                                                |
| ------------------------ | ------------------------------------ | --------------------- | ---------------------------------------------------------------------- |
| **Backend Queue Logic**  | `backend-server-example.cjs`         | `runWorker()`         | Orchestrates the processing of optimization jobs in the backend.       |
| **Frontend Status**      | `src/hooks/useBackendJobStatus.ts`   | `useBackendJobStatus` | Manages polling and state updates from the backend.                    |
| **Job Creation**         | `src/hooks/useDataHandlers.ts`       | `handleDataUpload`    | Creates optimization jobs on the backend.                              |
| **UI Components**        | `src/components/OptimizationQueuePopup.tsx` | - | Displays job queue status and allows user interaction.                 |
| **Core Algorithms**      | `src/utils/`                         | `adaptiveGridSearch`  | The actual CPU-intensive algorithms. Now executed on the backend.      |

---

## 4. "Gotchas" & Historical Context

- **The Main Thread Bottleneck**: The most critical historical fact is that running optimizations directly in `useOptimizationQueue.ts` was the primary source of all performance complaints.
- **The Completed Integration**: The backend infrastructure was created and is now fully functional. The worker processes jobs with realistic optimization results and proper progress tracking.
- **Portability of Logic**: A key architectural decision was to keep the core forecasting and optimization logic in plain TypeScript (`.ts` files), making it portable and easy to move between the client, a Web Worker, or a Node.js backend. 
- **Current Status**: The application now uses a robust backend-based job queue system that provides:
  - Persistent job storage in SQLite
  - Real-time progress tracking
  - Automatic result processing and state updates
  - User-friendly job management (clear completed, reset all)
  - Scalable architecture for handling large datasets
- **UI State Synchronization**: A critical lesson learned was to have a single component (`ForecastPage`) fetch the backend status and pass it down as props. Independent fetching in child components led to race conditions and UI bugs. This is documented further in `UI State Management & Data Flow.md`. 