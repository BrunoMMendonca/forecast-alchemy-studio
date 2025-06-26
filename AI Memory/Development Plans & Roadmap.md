# Development Plans & Roadmap

*This document stores active development plans, upcoming features, and technical decisions that need to be remembered across AI sessions.*

## 1. Active Development Plans

### Job Hash Implementation (In Progress)
**Goal**: Implement SHA-256 hashing (32 hex characters) to avoid redundant optimizations.

**Problem**: Currently, the system re-optimizes even when the same data, forecast horizon, model type, and method are used, wasting computational resources.

**Solution**: 
- Generate a SHA-256 hash of the job-defining parameters (cleaned historical data, forecast horizon, model type, method)
- Truncate to 32 hex characters for storage efficiency
- Store hash in database as `jobHash` column
- Before creating new jobs, check for existing completed jobs with same hash
- Skip optimization if duplicate found, reuse previous results

**Implementation Steps**:
1. Add `jobHash` column to jobs table
2. Create hash generation utility function using Node.js crypto module
3. Modify job creation logic to generate and store hash
4. Add deduplication check before job creation
5. Update frontend to handle reused results

**Files to Modify**:
- `src/backend/db.js` - Add jobHash column
- `server.js` - Add hash generation and deduplication logic
- Job creation endpoints in `server.js`

**Status**: Planning phase - ready for implementation

### Mobile Responsiveness Implementation (Planned)
**Goal**: Make the application smartphone-friendly with responsive design.

**Problem**: The current layout is desktop-only, with elements overlapping on small screens. The top part of the app (header, floating buttons, logo) is not optimized for mobile devices.

**Current State**: 
- Desktop-only layout with no responsive breakpoints
- Fixed positioning for floating elements
- No collapsible menu or mobile navigation
- Elements overlap on small screens

**Solution**: Implement responsive design using Tailwind's breakpoints:
- Add responsive breakpoints for mobile, tablet, and desktop
- Implement collapsible menu for mobile navigation
- Stack floating elements vertically on small screens
- Adjust chart and table layouts for mobile
- Ensure touch-friendly interactions

**Implementation Steps**:
1. Audit current layout for mobile compatibility
2. Add responsive breakpoints to all components
3. Implement mobile navigation menu
4. Test on various screen sizes
5. Optimize touch interactions

**Status**: Planning phase - ready for implementation

### Backend Migration Phase (Completed)
**Goal**: Move all major workflow steps to the backend for better performance, persistence, and multi-tenancy support.

**Status**: COMPLETED - All core functionality has been migrated to the backend.

**Completed Migrations**:
- ✅ Job queue and optimization processing
- ✅ AI and Grid optimization methods
- ✅ Method selection and parameter persistence
- ✅ Data upload and transformation
- ✅ Real-time job status monitoring

**Current Architecture**:
- Backend serves as the single source of truth for all application data
- Frontend acts as a consumer of backend APIs
- All heavy computation runs in backend workers
- Real-time updates via job status polling
- Persistent SQLite database for all data storage

**User Clarifications**:
- **Migration Approach**: Completed successfully with one-at-a-time migration
- **Performance Requirement**: App maintains fluid UX with background processing
- **Database**: SQLite successfully implemented for current scale
- **Data Migration**: Successfully completed from localStorage to backend
- **UX Requirement**: Frontend remains fluid with real-time backend status updates
- **Transition Period**: Successfully completed - all data now in backend

**Technical Implementation**:

#### Database: SQLite (Current)
**Status**: Successfully implemented and operational
- SQLite provides excellent performance for current scale
- File-based storage with easy backup and migration
- Ready for future upgrade to PostgreSQL/MySQL when needed

#### Data Storage Strategy (Completed)
**Phase 1**: ✅ Dual Storage Approach - Completed
- Successfully migrated from localStorage to backend
- Implemented data synchronization
- Maintained functionality during transition

**Phase 2**: ✅ Gradual Migration - Completed
- Successfully migrated existing data to backend
- No data loss during migration
- Smooth transition for users

**Phase 3**: ✅ Backend-Only - Completed
- Removed localStorage dependencies
- Cleaned up old code
- Backend is now single source of truth

#### Fluid UX Implementation (Completed)
**Background Processing**: ✅ All heavy operations run in backend with job queue
**Real-time Status**: ✅ Computation status shown via job monitor badge
**Non-blocking UI**: ✅ Users can navigate between pages and work on other features
**Progress Indicators**: ✅ Clear feedback for all backend operations
**Graceful Degradation**: ✅ Appropriate loading states when backend is slow

**Implementation Results**:
1. ✅ Historical Data Management - Fully migrated to backend
2. ✅ Clean and Prepare - Backend processing implemented
3. ✅ Forecast - Core business logic in backend
4. ✅ Explore - Analytics served from backend

**Next Phase**: Multi-tenancy and user authentication system

### Job Hash Implementation (In Progress)

---

## 2. Technical Decisions Made

### Job Queue Priority (Decision Made)
**Issue**: User asked about job priority and queue order
**Decision**: Current system uses FIFO (First In, First Out) order
- Backend worker processes jobs with `ORDER BY createdAt ASC LIMIT 1`
- Priority field exists in database but is not used
- No UI for setting priority exists
- No documentation of priority feature in AI Memory

**Future Consideration**: Priority system could be added but requires:
- Frontend UI for priority selection
- Backend worker modification to use priority field
- Documentation updates

---

## 3. Upcoming Features (Planned)

### Multi-Tenancy Implementation
**Goal**: Transform from single-user tool to multi-tenant SaaS platform
**Status**: Documented in `Authorization & Multi-Tenancy.md`
**Priority**: Next major phase after current optimizations

### Enhanced Job Progress Tracking
**Goal**: Improve job monitor badge to show accurate progress
**Status**: Recently implemented with robust batch tracking
**Current Logic**: Tracks all batch IDs since last reset, shows completed/total jobs

---

## 4. Bug Fixes & Improvements

### Running Job Status Display
**Issue**: "Running" count in UI almost always shows zero
**Root Cause**: Backend worker processes jobs too quickly or doesn't set status to 'running' before processing
**Potential Solutions**:
- Add status update to 'running' before processing starts
- Reduce frontend polling interval
- Add more granular status updates during processing

---

## 5. Architecture Decisions

### Single Source of Truth Pattern
**Decision**: Use page-level components (like `ForecastPage`) to fetch data and pass down as props
**Reasoning**: Prevents UI state inconsistencies and race conditions
**Implementation**: Documented in `UI State Management & Data Flow.md`

### Backend-Powered Optimization
**Decision**: All heavy computation moved to backend with persistent job queue
**Reasoning**: Solves UI freezing issues and provides scalable architecture
**Implementation**: Documented in `Performance & Scalability Strategy.md`

---

## 6. User Questions & Quick Asks

*This section is for quick questions, clarifications, or small tasks that need attention.*

**Current Questions**:
- [Add your questions here]

**Recent Questions**:
- [Track resolved questions here]

---

## 7. Notes for Future Sessions

- Always check this document for active plans before starting new work
- Update status of plans as they progress from planning → implementation → testing → complete
- Add new plans here when they arise during development
- Reference specific AI Memory documents for detailed technical implementation guides
- Remember that the user prefers AI-powered and manual processes to be implemented similarly
- Follow the single source of truth pattern for UI state management
- Check the "User Questions & Quick Asks" section for pending items

---

**Last Updated**: [Current Session]
**Next Review**: [Next Session]

## 2. Recently Implemented

### Manual Import Refactor (Complete)
- The manual import flow now ensures that after the preview step, all mapping, normalization, and backend upload use the cleaned, de-blanked, user-confirmed preview data (wide format).
- The backend no longer re-parses the raw CSV; it receives and processes only the cleaned data.
- This eliminates "Invalid Date" and blank column bugs, and ensures WYSIWYG import.

### AI Import Flow (Already Robust)
- The AI import flow already uses the cleaned preview data for transformation and backend upload.
- No re-parsing of the raw CSV after preview.
- The preview and final import are consistent.

---

## 3. Lessons Learned
- Never re-parse the raw CSV after preview. Always use the cleaned, user-confirmed data for all further steps.
- Be explicit about when you're using wide vs. long format, and only transform when necessary.
- WYSIWYG: What the user sees in the preview is exactly what gets imported.

---

## 4. Next Steps
- Continue backend migration for other workflow steps.
- Maintain explicit data format handling and single-source-of-truth patterns throughout the app.

---

## 8. Recently Completed Fixes

### File Naming Convention Implementation (Completed)
**Goal**: Implement consistent file naming convention for all dataset-related files.

**Problem**: Files were using inconsistent naming patterns, making it difficult to track relationships between original, processed, and cleaning data.

**Solution**: Implemented the `<BaseName>-<ShortHash>-<Type>.<ext>` naming convention:
- **BaseName**: `Original_CSV_Upload-<timestamp>`
- **ShortHash**: First 8 characters of SHA-256 hash
- **Type**: `original`, `processed`, `cleaning`, or `discarded`
- **Extension**: `.csv` for original files, `.json` for processed/cleaning files

**Implementation Results**:
- ✅ All backend endpoints updated to use new naming convention
- ✅ Frontend components updated to extract baseName and hash from file paths
- ✅ Existing data detection updated to use new API format
- ✅ Consistent file organization and hash-based duplicate detection

### Dataset Switching & Cleaning Data Loading (Completed)
**Goal**: Fix issues with dataset switching and cleaning data persistence.

**Problem**: 
- After cleaning data, the dataset would be "unloaded" and show "No data available for cleaning"
- Switching between datasets would show cleaning data from the wrong dataset
- Backend was returning cleaning file paths instead of processed file paths

**Solution**:
- Fixed `/save-cleaned-data` endpoint to return processed file path instead of cleaning file path
- Implemented proper state reset when switching datasets
- Added cleaning data loading logic that checks for existing cleaning data per dataset hash

**Implementation Results**:
- ✅ Dataset remains loaded after cleaning operations
- ✅ Proper cleaning data loading for each dataset
- ✅ Clean state separation between different datasets
- ✅ No more "Could not extract baseName and hash from filePath" errors

### Auto-Loading Loading State (Completed)
**Goal**: Eliminate UI flash during dataset auto-loading.

**Problem**: Brief flash of "Choose your data" step before auto-loaded dataset appeared.

**Solution**: Implemented loading state that shows spinner instead of normal content during auto-loading.

**Implementation Results**:
- ✅ Smooth UI transitions during app startup
- ✅ Clear loading feedback for users
- ✅ Consistent visual structure during auto-loading
- ✅ Improved perceived performance 

### Major UI/UX Enhancements (Completed)
**Goal**: Improve the data cleaning experience with a fullscreen modal and enhance overall UI layout.

**Problem**: 
- Data cleaning was limited to a small chart and separate table
- Job Monitor button overlapped with toasts and other UI elements
- Logo and branding were not prominently displayed
- Chart data logic was inconsistent between modal and main view

**Solution**:
- **Fullscreen Data Clean Modal**: Created a comprehensive modal that combines chart and table editing in one interface
- **Floating UI Elements**: Moved Job Monitor and Setup buttons to a dedicated floating container at top right
- **Logo Branding**: Moved logo to a floating container at top left, removed header title
- **Globalized Controls**: SKU selector, z-score selector, and navigation buttons are now globalized between modal and main app
- **Chart Data Logic**: Fixed original/cleaned series display to use consistent fallback logic
- **Enhanced UX**: Added keyboard shortcuts, auto-selecting largest outlier, improved input styling

**Implementation Results**:
- ✅ Fullscreen modal with chart filling available space and edit table below
- ✅ Seamless state synchronization between modal and main app
- ✅ Improved floating UI layout with no overlapping elements
- ✅ Professional branding with prominent logo placement
- ✅ Consistent chart data display across all views
- ✅ Enhanced user experience with keyboard shortcuts and auto-selection
- ✅ Responsive chart that fills all available space
- ✅ Modern input styling with blue borders and proper alignment

**Key Technical Details**:
- Modal uses Radix Dialog with custom CSS for fullscreen display
- Chart data builds single array with both `originalSales` and `cleanedSales` fields
- Fallback logic: `cleanedData.length > 0 ? cleanedData : originalData`
- Globalized state ensures changes in modal update main app and vice versa
- Keyboard shortcuts: Enter to save (except Shift+Enter in textarea)
- Auto-selection targets data point with largest outlier z-score when switching SKUs 