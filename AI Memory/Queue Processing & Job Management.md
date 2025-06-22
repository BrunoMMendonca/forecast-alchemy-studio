# Backend Job Queue & Worker: Implementation Guide

## 1. Core Principles

- **Backend as the Single Source of Truth:** The job queue's state is managed entirely by the backend server in a persistent SQLite database. The frontend is a consumer of this state. In the future, this principle will expand to include all user data (datasets, forecasts, etc.).
- **API-Driven Operations:** All queue mutations (creating jobs, clearing the queue) are handled via API endpoints. The frontend does not manipulate the queue state directly.
- **Persistent & Asynchronous:** Jobs are stored in a database, allowing a separate worker process to execute them asynchronously. This ensures that UI performance is never blocked by optimizations and that jobs are not lost on browser refresh.
- **Robust Job Creation:** The job creation endpoint can handle both full dataset uploads and specific SKU lists, with a "reason" for tracking job origins.

---

## 2. How It Works

### A. The Lifecycle of a Job

1.  **Job Creation (Frontend)**:
    - A user action (like uploading a file or cleaning data) triggers a function in `useDataHandlers.ts`.
    - This handler makes a `POST` request to the `/api/jobs` endpoint on the backend, sending along the relevant data, models, and a reason for the job.

2.  **Job Ingestion (Backend API)**:
    - The `server.js` receives the request.
    - It parses the request and creates corresponding job entries in the `jobs` table in the SQLite database. Each job is initially marked with a `pending` status.

3.  **Job Processing (Backend Worker)**:
    - A separate worker process, started by running `node server.js worker`, continuously polls the database for `pending` jobs (`runWorker()` function).
    - When a job is found, the worker updates its status to `running` and begins executing the optimization logic.
    - It periodically updates the job's `progress` in the database.
    - Upon completion, the worker updates the job's status to `completed` and stores the final result as a JSON string in the `result` column. If an error occurs, the status is set to `failed`.

4.  **Status Polling (Frontend)**:
    - The `useBackendJobStatus.ts` hook on the frontend periodically sends a `GET` request to the `/api/jobs/status` endpoint.
    - The backend returns the current list of all jobs from the database.
    - The hook processes these jobs, updates its internal state (`jobs`, `summary`), and makes the data available to the UI.

5.  **UI Updates**:
    - The `ForecastPage.tsx` component consumes the data from `useBackendJobStatus`.
    - It passes this data down to child components like `MainLayout` and `OptimizationQueuePopup`.
    - This "single source of truth" pattern ensures all UI elements are always in sync with the backend's state.

---

## 3. Technical Details

### A. Key Code Points

| Area                     | File / Component                     | Key Function / Hook         | Purpose                                                      |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| **Job Creation (Client)**| `src/hooks/useDataHandlers.ts`       | `handleDataUpload`          | Submits job requests to the backend API.                     |
| **Job Ingestion (Server)**| `server.js`         | `app.post('/api/jobs')`     | Creates job records in the SQLite database.                  |
| **Job Processing (Server)**| `server.js`         | `runWorker` / `processJob`  | Fetches and executes pending jobs from the database.         |
| **Status Polling (Client)**| `src/hooks/useBackendJobStatus.ts`   | `useBackendJobStatus`       | Periodically fetches job status from the backend.            |
| **UI Display**           | `src/components/OptimizationQueuePopup.tsx` | -                   | Renders the job queue and progress to the user.              |
| **UI State Management**  | `src/pages/ForecastPage.tsx`         | -                           | Acts as the single source of truth for all job-related UI.   |

---

## 4. Troubleshooting Checklist

If queue processing fails or behaves unexpectedly, check the following:

1.  **Are the backend API and Worker processes running?** You need two terminals: one for `node server.js api` and one for `node server.js worker`.
2.  **Are jobs being created correctly in the `forecast-jobs.db` file?** Use a SQLite viewer to inspect the `jobs` table.
3.  **Is the backend worker picking up pending jobs?** Check the terminal output for the worker process for logs like "Worker: Picked up job...".
4.  **Is the frontend successfully polling the `/api/jobs/status` endpoint?** Check the browser's network tab for successful `200 OK` responses.
5.  **Is the `ForecastPage` component passing the `jobs` and `summary` props correctly down to its children?** This was the source of a previous bug that caused UI inconsistencies.

---

## 5. Gotchas & Historical Context

- **Initial Architecture**: The application's first version of a queue (`useOptimizationQueue.ts`) ran on the browser's main thread, which caused the UI to freeze during long optimizations. This file and pattern are now obsolete.
- **The Backend Shift**: The architecture was migrated to a full backend job queue to solve the UI freezing issue and provide a more scalable, persistent solution. The current implementation is robust and the "completed" state of this migration.
- **UI State Synchronization**: A critical lesson learned was to have a single component (`ForecastPage`) fetch the backend status and pass it down as props. Independent fetching in child components led to race conditions and UI bugs. This is documented further in `UI State Management & Data Flow.md`. 