# Queue Processing & Job Management: Implementation Guide

## 1. Core Principles

- **Single Source of Truth:** The queue state is managed globally (React context/store), ensuring all mutations and reads are consistent and up-to-date.
- **Job Types:** Supports both AI (Grok API) and Grid Search optimizations, with robust enable/disable logic for AI jobs.
- **Persistence:** The queue state is persisted to localStorage and restored on app load, ensuring jobs are not lost on refresh.
- **Defensive Filtering:** AI jobs are filtered out immediately if AI is disabled, both when adding jobs and via a dedicated effect.
- **Failure Handling:** Consecutive AI failures trigger automatic disabling of AI optimization and removal of all AI jobs from the queue.
- **Logging:** Logging is concise and focused on key events (job add, remove, process, error, AI job removal), with summary logs for queue state.

---

## 2. How It Works

### A. Queue Lifecycle

- **Adding Jobs:**
  - Jobs are added to the queue when new data is uploaded, cleaned, or when settings change (see `Optimization reassons.md`).
  - Defensive checks ensure AI jobs are only added if both global AI features and AI optimization are enabled.
  - Each job includes SKU, model, method (AI/Grid), and a reason for tracking.

- **Processing Jobs:**
  - The queue is processed sequentially, one job at a time, using a local reference to track remaining jobs.
  - After each job is processed, it is removed from the queue and the global state is updated.
  - If jobs are added during processing, the local reference ensures the new jobs are picked up in the next processing cycle.

- **AI Job Removal:**
  - An effect watches for changes to AI enable/disable settings.
  - When AI is disabled, all AI jobs are immediately removed from the queue, and a summary log is generated.

- **AI Failure Threshold:**
  - If AI jobs fail consecutively (configurable threshold), AI optimization is automatically disabled and all AI jobs are removed.
  - A toast/notification is shown to the user.

- **Persistence:**
  - The queue is saved to localStorage after every mutation (add, remove, clear, AI job removal).
  - On app load, the queue is restored from localStorage, with AI jobs filtered out if AI is disabled.

---

## 3. Technical Details

### A. Queue Structure

- The queue is an array of job objects, each with:
  - `sku`: The SKU being optimized
  - `modelId`: The model to optimize
  - `method`: 'ai' or 'grid'
  - `reason`: Why the job was added (e.g., 'csv_upload_sales_data')

### B. Key Code Points

- **Adding Jobs:**
  - All job additions go through a single function that checks AI enablement before adding AI jobs.
  - Logs the number and type of jobs added, and the queue state after addition.

- **Processing Jobs:**
  - Uses a local `remainingItems` array to avoid stale state and infinite loops.
  - After each job, updates both the local array and the global queue state.
  - Logs each job as it is processed and when it is removed.

- **AI Job Removal Effect:**
  - Runs whenever AI enablement changes.
  - If AI is disabled, filters out all AI jobs and updates the queue.
  - Logs before and after state for transparency.

- **AI Failure Handling:**
  - Tracks consecutive AI failures.
  - On threshold, disables AI optimization, removes AI jobs, and notifies the user.

- **Persistence:**
  - Queue is saved to localStorage after every change.
  - On load, queue is restored and AI jobs are filtered if needed.

### C. Logging

- Only logs key events:
  - When jobs are added (summary: total, AI, grid)
  - When queue processing starts/ends
  - Each job as it is processed
  - Errors
  - When AI jobs are filtered out
  - Queue state after every mutation

---

## 4. Troubleshooting Checklist

If queue processing fails or behaves unexpectedly, check the following:

1. **Is the queue state always updated via the global store/context?**
2. **Are AI jobs being filtered out immediately when AI is disabled?**
3. **Is the local `remainingItems` array used for processing, not the global queue reference?**
4. **Are jobs being removed from the queue after processing?**
5. **Is the queue persisted to and restored from localStorage?**
6. **Are logs showing the correct queue state after each mutation?**
7. **Is the AI failure threshold logic working and disabling AI as expected?**

---

## Summary Table

| Event                        | Queue Mutation         | AI Jobs Filtered? | Logging         | Persistence |
|------------------------------|-----------------------|-------------------|-----------------|-------------|
| Add jobs (data/settings)     | Add, dedupe           | Yes (if disabled) | Summary         | Yes         |
| Process jobs                 | Remove after process  | N/A               | Per job, summary| Yes         |
| Disable AI                   | Remove all AI jobs    | Yes               | Summary         | Yes         |
| AI failure threshold reached | Remove all AI jobs, disable AI | Yes      | Summary, toast   | Yes         |
| App load                     | Restore from storage  | Yes (if disabled) | N/A             | Yes         |

---

**If you ever need to restore or debug this logic, reference this guide and ensure:**
- All queue mutations use the global state.
- AI jobs are filtered out immediately when AI is disabled.
- The local array is used for processing, not the global queue reference.
- Logging is concise and focused on key events.
- Persistence is robust and always reflects the latest queue state. 