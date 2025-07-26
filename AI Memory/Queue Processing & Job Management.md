# Queue Processing & Job Management: A Technical Guide

*This document outlines the backend job queue system that manages optimization tasks, ensuring reliable processing and real-time status updates with enhanced UI features.*

## Key Features
- Real-time status updates and progress tracking
- User-friendly queue management interface
- Visual indicators for job status and progress
- **Merged Jobs:** Duplicate jobs are now marked as 'Merged' (replacing 'Skipped'), with clear banners, tooltips, and batch-level progress summaries in the UI.

## 1. Core Problem / Use Case

The application needs to handle long-running optimization tasks without blocking the UI. Users need real-time visibility into optimization progress, the ability to manage jobs, and a clear understanding of which models are being processed.

**Key Requirements:**
- Asynchronous processing of optimization jobs
- Real-time status updates and progress tracking
- User-friendly queue management interface
- Visual indicators for job status and progress
- Batch management and priority handling
- Error handling and recovery mechanisms

---

## 2. How It Works: The Job Queue Architecture

### A. Backend Components

**Job Queue**: SQLite-based persistent queue (`forecast-jobs.db`)
- Stores all optimization jobs with status, priority, and metadata
- Ensures jobs persist across server restarts
- Supports batch operations and job relationships

**Worker Process**: Background process that processes jobs from the queue
- Continuously polls for pending jobs
- Updates job status in real-time
- Handles job failures and retries

**Status API**: REST endpoints that provide real-time job status
- `/api/jobs/status` - Get current job status and queue information
- `/api/jobs/cancel/:id` - Cancel a specific optimization
- `/api/jobs/pause/:id` - Pause a specific optimization
- `/api/jobs/resume/:id` - Resume a paused optimization
- `/api/jobs/clear-completed` - Clear all completed jobs
- `/api/jobs/reset` - Reset all optimizations

### B. Frontend Components

**OptimizationQueue**: Main queue display component with enhanced UI
- Comprehensive model status table
- Real-time updates and progress tracking
- Action controls for job management

**OptimizationQueuePopup**: Modal wrapper for the queue interface
- Provides easy access from main UI
- Responsive design for different screen sizes

**OptimizationStatusContext**: React context for status management
- Manages global optimization state
- Provides status updates to all components

**useOptimizationStatus**: Hook for accessing optimization status
- Subscribes to status updates
- Provides status data to components

---

## 3. Enhanced UI Features (Recently Implemented)

### A. Model Status Table

**Comprehensive Display**
- Shows all model/method combinations with their current status
- Displays job progress, priority, and completion status
- Provides clear visual hierarchy and organization

**Visual Improvements**
- **Row Striping**: Alternating row colors for better readability
- **Status Icons**: Visual icons for different job statuses (pending, running, completed, failed)
- **Progress Bars**: Individual progress bars for each model/method combination
- **Column Distribution**: Evenly distributed columns with proper spacing
- **Status Alignment**: Status icon and text aligned on single line using flex containers

**Table Structure**
```typescript
interface JobStatusRow {
  modelId: string;
  method: 'grid' | 'ai';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  priority: 'high' | 'medium' | 'low' | 'normal';
  startTime?: string;
  endTime?: string;
  error?: string;
}
```

### B. Optimization Queue Interface

**Summary Statistics**
- Overview cards showing active, completed, failed, and total jobs
- Real-time counters that update automatically
- Visual indicators for queue health

**Tabbed Interface**
- Separate tabs for active, completed, and failed optimizations
- Easy navigation between different job states
- Filtered views for better organization

**Real-time Updates**
- Automatic refresh of job status without manual intervention
- WebSocket-like experience with polling
- Immediate UI updates when jobs change state

### C. Action Controls

**Individual Controls**
- Pause, resume, and cancel individual optimizations
- Context-sensitive actions based on job status
- Confirmation dialogs for destructive actions

**Bulk Actions**
- Clear completed jobs to free up resources
- Reset all optimizations for fresh start
- Batch operations for efficiency

**Progress Tracking**
- Overall progress bar showing queue completion
- Individual job progress indicators
- Time estimates for remaining work

---

## 4. Job Lifecycle Management

### A. Job Creation
1. **Trigger**: Optimization is triggered by data changes or user actions
2. **Validation**: System validates job parameters and requirements
3. **Queuing**: Job is added to SQLite database with 'pending' status
4. **Notification**: User is notified of job creation

### B. Job Processing
1. **Worker Pickup**: Background worker selects next available job
2. **Status Update**: Job status changes to 'running'
3. **Processing**: Model optimization runs with progress updates
4. **Completion**: Job is marked as 'completed' or 'failed'

### C. Job Cleanup
1. **Result Storage**: Optimization results are stored in database
2. **State Update**: UI state is updated with new results
3. **Cleanup**: Completed jobs can be cleared from queue
4. **Notification**: User is notified of job completion

---

## 5. Database Schema

### A. Jobs Table
```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  filePath TEXT NOT NULL,
  sku TEXT NOT NULL,
  modelId TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  batchId TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  startedAt DATETIME,
  completedAt DATETIME,
  error TEXT,
  result TEXT
);
```

### B. Optimizations Table
```sql
CREATE TABLE optimizations (
  id INTEGER PRIMARY KEY,
  batchId TEXT UNIQUE NOT NULL,
  filePath TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME
);
```

### C. Results Table
```sql
CREATE TABLE results (
  id INTEGER PRIMARY KEY,
  jobId INTEGER,
  modelId TEXT NOT NULL,
  method TEXT NOT NULL,
  parameters TEXT,
  metrics TEXT,
  predictions TEXT,
  FOREIGN KEY (jobId) REFERENCES jobs(id)
);
```

---

## 6. Integration Points

### A. ForecastEngine Integration
- Triggers optimization when data changes
- Displays optimization status and progress
- Provides access to optimization controls

### B. ModelParameterPanel Integration
- Shows model eligibility and status
- Displays optimization results
- Provides parameter adjustment controls

### C. MainLayout Integration
- Provides queue access via floating button
- Shows overall optimization status
- Manages optimization state globally

### D. OptimizationStatusContext Integration
- Manages global optimization state
- Provides status updates to all components
- Handles optimization lifecycle events

---

## 7. Error Handling & Recovery

### A. Failed Jobs
- Jobs that fail are marked with error details
- Error messages are displayed in the UI
- Failed jobs can be retried or cancelled

### B. Retry Logic
- Automatic retry for transient failures
- Configurable retry limits and intervals
- Manual retry options for failed jobs

### C. User Notifications
- Toast notifications for job status changes
- In-app notifications for important events
- Email notifications for long-running jobs

### D. Error Recovery
- Manual reset capabilities for stuck jobs
- Queue cleanup for corrupted jobs
- System recovery after server restarts

---

## 8. Performance Considerations

### A. Batch Processing
- Multiple jobs processed efficiently
- Batch operations reduce database load
- Parallel processing where possible

### B. Status Polling
- Optimized polling intervals to reduce server load
- Adaptive polling based on queue activity
- Efficient status updates to minimize bandwidth

### C. Memory Management
- Completed jobs can be cleared to free resources
- Result caching for frequently accessed data
- Automatic cleanup of old job data

### D. Concurrent Processing
- Worker can handle multiple jobs simultaneously
- Queue prioritization for important jobs
- Resource allocation based on job complexity

---

## 9. "Gotchas" & Historical Context

- **Job Persistence**: Jobs are stored in SQLite, so they persist across server restarts. This ensures no work is lost.
- **Status Synchronization**: The frontend polls for status updates. Ensure polling intervals are appropriate for your use case.
- **Batch Management**: Jobs are grouped by batch ID for efficient processing. Use batch operations when possible.
- **Priority Handling**: Jobs have priority levels that affect processing order. High priority jobs are processed first.
- **Error Recovery**: Failed jobs can be retried or cancelled. Always check error messages for debugging.
- **Queue Cleanup**: Regularly clear completed jobs to prevent queue bloat and improve performance.

---

## 10. Future Enhancements

### A. Planned Features
- **WebSocket Support**: Real-time updates without polling
- **Advanced Scheduling**: Time-based job scheduling
- **Resource Monitoring**: CPU and memory usage tracking
- **Job Dependencies**: Complex job workflows with dependencies

### B. Performance Improvements
- **Distributed Processing**: Multiple worker processes
- **Job Queuing**: Advanced queuing algorithms
- **Caching**: Result caching for repeated optimizations
- **Compression**: Data compression for large results

### C. User Experience
- **Job Templates**: Save and reuse job configurations
- **Progress Estimation**: Better time estimates for jobs
- **Notification Preferences**: Customizable notification settings
- **Mobile Support**: Responsive design for mobile devices

---

## 5. UI/UX: Optimization Queue
- **Merged Jobs:** When a duplicate optimization is detected, the new job is marked as 'Merged' instead of 'Skipped'.
- **Banner:** An orange banner at the top of the queue informs users how many jobs were merged and why, referencing the 'Merged' tab for details.
- **Summary Cards & Tabs:** The queue UI uses the terminology 'Merged' everywhere (cards, tabs, batch summaries), with the Merge icon and orange color for consistency.
- **Batch-Level Progress:** The batch progress summary row now shows 'Merged' (with icon) instead of 'Skipped'.
- **Tooltips & Info:** Tooltips and a 'Learn more' button provide user-friendly explanations of what 'Merged' means, reducing confusion about data freshness and job deduplication.
- **No More 'Skipped':** The term 'Skipped' has been fully removed from the UI and documentation in favor of 'Merged'.

## 6. User Experience
- Users are clearly informed when jobs are merged, why it happens, and that the latest data will always be used.
- The UI is consistent, modern, and avoids confusion about job status or data freshness.

**For related documentation, see:**
- `Forecast Methods & Parameter Persisten.md` - Parameter persistence and method selection
- `Performance & Scalability Strategy.md` - Backend architecture overview
- `UI State Management & Data Flow.md` - Frontend state management patterns 
---

## 5. UI/UX: Optimization Queue
- **Merged Jobs:** When a duplicate optimization is detected, the new job is marked as 'Merged' instead of 'Skipped'.
- **Banner:** An orange banner at the top of the queue informs users how many jobs were merged and why, referencing the 'Merged' tab for details.
- **Summary Cards & Tabs:** The queue UI uses the terminology 'Merged' everywhere (cards, tabs, batch summaries), with the Merge icon and orange color for consistency.
- **Batch-Level Progress:** The batch progress summary row now shows 'Merged' (with icon) instead of 'Skipped'.
- **Tooltips & Info:** Tooltips and a 'Learn more' button provide user-friendly explanations of what 'Merged' means, reducing confusion about data freshness and job deduplication.
- **No More 'Skipped':** The term 'Skipped' has been fully removed from the UI and documentation in favor of 'Merged'.

## 6. User Experience
- Users are clearly informed when jobs are merged, why it happens, and that the latest data will always be used.
- The UI is consistent, modern, and avoids confusion about job status or data freshness.

**For related documentation, see:**
- `Forecast Methods & Parameter Persisten.md` - Parameter persistence and method selection
- `Performance & Scalability Strategy.md` - Backend architecture overview
- `UI State Management & Data Flow.md` - Frontend state management patterns 