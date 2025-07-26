# Workflow Summary: A Technical Guide

*This document summarizes the main steps of the application's workflow, from data upload and cleaning to forecasting and optimization, including recent UI/UX enhancements and troubleshooting tips.*

## 1. Core Workflow Overview

The application follows a structured workflow designed to transform raw CSV data into actionable forecasts through a series of interconnected steps. Each step builds upon the previous one, with data flowing seamlessly through the system.

---

## 2. Step-by-Step Workflow

### Step 1: Upload & Transform
- **Purpose**: Import CSV data and transform it into the standardized format required for forecasting.
- **Process**: 
  - User uploads CSV file (drag-and-drop or file picker)
  - System auto-detects separator, date format, and number format
  - **NEW**: Robust format validation with visual error indicators
  - **NEW**: Progression blocking when validation errors exist
  - User can choose AI-powered or manual transformation
  - Data is cleaned, normalized, and prepared for analysis
- **Output**: Standardized dataset ready for cleaning and analysis.
- **Persistence**: All data is stored in the backend database with hash-based duplicate detection.

### Step 2: Clean & Prepare
- **Purpose**: Identify and correct outliers, add notes, and ensure data quality.
- **Process**:
  - **NEW**: Fullscreen data cleaning modal with enhanced UX
  - **NEW**: Globalized controls between modal and main app
  - **NEW**: Keyboard shortcuts and auto-selection features
  - Interactive chart shows outliers with z-score highlighting
  - User can edit individual data points or import bulk corrections
  - **NEW**: Enhanced table editing with improved input styling
  - **NEW**: Responsive chart that fills available space
- **Output**: Cleaned dataset with outlier corrections and notes.
- **Persistence**: Cleaning data is saved to backend with new naming convention.

### Step 3: Forecast & Optimize
- **Purpose**: Generate forecasts using optimized model parameters for each SKU.
- **Process**:
  - **NEW**: Enhanced optimization queue UI with comprehensive model status table
  - **NEW**: Row striping, status icons, and progress bars for better readability
  - **NEW**: Column distribution and spacing improvements
  - **NEW**: Status alignment using flex containers
  - **NEW**: Action buttons positioned below table with proper spacing
  - **NEW**: Summary statistics and tabbed interface for job management
  - **NEW**: Real-time updates and batch management features
  - System automatically optimizes model parameters using grid search
  - AI-enhanced optimization available if enabled
  - Manual parameter adjustment always available
  - Results are displayed with performance metrics and visualizations
- **Output**: Optimized forecasts with performance metrics for each SKU/model combination.
- **Persistence**: All optimization results and parameter selections are stored in the backend database.

### Step 4: Tune (In Development)
- **Purpose**: Fine-tune forecasts and make manual adjustments with AI assistance.
- **Process**:
  - User selects best model for each SKU
  - Final forecast is displayed alongside historical data
  - Manual adjustments can be made to forecast values
  - AI chat assists with bulk or complex adjustments
- **Output**: Final, tuned forecasts ready for business use.

---

## 3. Recent UI/UX Enhancements

### A. Data Cleaning Improvements
- **Fullscreen Modal**: Comprehensive data cleaning interface that combines chart and table editing
- **Globalized Controls**: SKU selector, z-score selector, and navigation buttons sync between modal and main app
- **Enhanced UX**: Keyboard shortcuts, auto-selecting largest outlier, improved input styling
- **Responsive Design**: Chart fills all available space with proper proportions

### B. Optimization Queue Enhancements
- **Model Status Table**: Comprehensive display of all model/method combinations with current status
- **Visual Improvements**: Row striping, status icons, progress bars, and proper column distribution
- **Status Alignment**: Status icon and text aligned on single line using flex containers
- **Summary Cards & Tabs**: Now use 'Merged' (with icon) instead of 'Skipped' for duplicate jobs, with consistent terminology throughout the UI
- **Batch-Level Progress**: The batch progress summary row now shows 'Merged' (with icon) instead of 'Skipped'
- **Banner**: An orange banner at the top of the queue informs users how many jobs were merged and why, referencing the 'Merged' tab for details
- **Tooltips & Info**: Tooltips and a 'Learn more' button provide user-friendly explanations of what 'Merged' means, reducing confusion about data freshness and job deduplication
- **No More 'Skipped'**: The term 'Skipped' has been fully removed from the UI and documentation in favor of 'Merged'
- **Real-time Updates**: Automatic refresh of job status without manual intervention

### C. CSV Import Validation
- **Strict Format Validation**: Enhanced validation for dates and numbers with visual error indicators
- **Progression Blocking**: Users cannot proceed when validation errors exist
- **Standardized Error Handling**: Consistent ErrorHandler component styling across all error states
- **Helpful Guidance**: Contextual suggestions and links for fixing validation issues

---

## 4. Data Flow Architecture

### A. Single Source of Truth
- **Backend Database**: All data is stored in SQLite database
- **Zustand Stores**: Frontend state management with automatic reactivity
- **Real-time Sync**: UI updates automatically reflect backend state changes

### B. State Management
- **Model UI Store**: Manages model parameters, method selection, and optimization state
- **SKU Store**: Manages selected SKU with persistence
- **Forecast Results Store**: Manages forecast results and pending operations
- **Optimization Status**: Real-time job status and queue management

### C. Data Persistence
- **Backend Storage**: All data persists in SQLite database
- **Hash-based Detection**: Prevents duplicate imports and enables existing data loading
- **Automatic Cleanup**: Old data is automatically managed to prevent bloat

---

## 5. Optimization System

### A. Trigger Mechanisms
- **Data Changes**: New uploads or data cleaning trigger optimization
- **Settings Changes**: Relevant configuration changes trigger re-optimization
- **Manual Triggers**: Users can manually trigger optimization for specific SKUs

### B. Optimization Methods
- **Grid Search**: Systematic parameter optimization across all models
- **AI Enhancement**: AI-powered parameter refinement (optional)
- **Manual Mode**: Direct parameter adjustment by users

### C. Queue Management
- **Persistent Queue**: Jobs persist across server restarts
- **Real-time Status**: Live updates of job progress and status
- **Batch Operations**: Efficient processing of multiple jobs
- **Error Handling**: Robust error recovery and retry mechanisms

---

## 6. Performance Considerations

### A. Backend Processing
- **Asynchronous Jobs**: Long-running operations don't block the UI
- **Worker Processes**: Background processing for optimization tasks
- **Database Optimization**: Efficient queries and indexing for large datasets

### B. Frontend Performance
- **Selective Rendering**: Components only re-render when their data changes
- **Optimized Polling**: Efficient status updates without excessive API calls
- **Memory Management**: Automatic cleanup of old data and completed jobs

### C. Scalability
- **Modular Architecture**: Easy to add new models and features
- **Batch Processing**: Efficient handling of multiple SKUs and models
- **Resource Management**: Automatic resource allocation and cleanup

---

## 7. Troubleshooting Guide

### A. Common Issues
- **Import Errors**: Check CSV format and validation settings
- **Optimization Failures**: Review job status and error messages
- **Performance Issues**: Monitor queue status and resource usage
- **Data Sync Issues**: Verify backend connectivity and state management

### B. Debug Tools
- **Zustand Debugger**: Built-in state inspection and debugging
- **Job Monitor**: Real-time queue status and job management
- **Error Logs**: Detailed error messages and stack traces
- **Performance Metrics**: System performance and resource usage

### C. Recovery Procedures
- **Failed Jobs**: Retry or cancel failed optimizations
- **Data Corruption**: Restore from backup or re-import data
- **State Issues**: Reset stores or restart application
- **Queue Problems**: Clear completed jobs or reset optimization queue

---

## 8. Future Enhancements

### A. Planned Features
- **Advanced Tuning**: Enhanced forecast adjustment capabilities
- **Collaborative Features**: Multi-user support and sharing
- **Advanced Analytics**: Deeper insights and performance analysis
- **Mobile Support**: Responsive design for mobile devices

### B. Performance Improvements
- **WebSocket Support**: Real-time updates without polling
- **Caching**: Result caching for repeated operations
- **Distributed Processing**: Multiple worker processes
- **Compression**: Data compression for large datasets

### C. User Experience
- **Workflow Templates**: Save and reuse workflow configurations
- **Progress Estimation**: Better time estimates for long operations
- **Notification System**: Enhanced user notifications and alerts
- **Help System**: Contextual help and documentation

---

**For related documentation, see:**
- `Upload Wizard & Data Transformation.md` - Detailed import process
- `Data Cleaning Methods & Implementation.md` - Cleaning workflows
- `Queue Processing & Job Management.md` - Optimization system
- `UI State Management & Data Flow.md` - State management patterns










