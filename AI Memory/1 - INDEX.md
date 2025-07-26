# AI Memory Index

- **Authorization & Multi-Tenancy.md**  
  Outlines the architecture for multi-tenant, role-based access, including organizations, user roles, database schema, and API/authorization logic.

- **Backend Migration Consistency Check.md**  
  Documents the completed migration of all core functionality to the backend, confirms architectural principles, and lists next steps for multi-tenancy and user authentication.

- **CSV Import Validation & Error Handling.md**  
  Documents comprehensive improvements to CSV import validation and error handling: strict format validation for dates and numbers, progression blocking when validation errors exist, standardized ErrorHandler component for consistent UI styling, visual error indicators in preview tables, column count validation to prevent separator mismatch, and helpful links for format assistance. **Ensures users cannot proceed with invalid data and provides clear guidance on how to fix issues.**

- **Data Cleaning Methods & Implementation.md**  
  Explains the two main data cleaning workflows: CSV import/export and interactive editing, with backend integration, UI, and technical details.

- **Development Plans & Roadmap.md**  
  Stores active and upcoming development plans, technical decisions, and completed migrations. Includes job hash, mobile responsiveness, and multi-tenancy plans.

- **Forecast Methods & Parameter Persisten.md**  
  Details how method selection and parameter persistence work, including backend storage, auto-selection logic, and troubleshooting.

- **Forecasting Models & Architecture.md**  
  Describes the modular backend model system, the ModelFactory pattern, how to add new models, and the dynamic model discovery process.

- **Metric Weight Change Optimization Trigger.md**  
  Documents how changing metric weights in settings triggers automatic re-optimization, with architectural flow and key code pointers.

- **Optimization reasons.md**  
  Lists all triggers for optimization jobs (CSV upload, data cleaning, config changes, etc.) and their scopes.

- **Optimization reassons.md**  
  Duplicate/variant of "Optimization reasons.md" with similar content on optimization triggers and job management.

- **Optimization Results Export System.md**  
  Outlines the CSV export system for optimization results, including backend API, frontend UI, data structure, and usage examples. **Now documents the backend logic to extract and export fitted p, d, q, P, D, Q, s parameters for ARIMA/SARIMA in auto mode, ensuring CSV and UI always show actual fitted values, not just the 'auto' flag.**

- **Performance & Scalability Strategy.md**  
  Outlines the backend-powered architecture for handling performance-intensive tasks, focusing on offloading model optimization to backend workers, persistent job queues, and UI state synchronization to ensure scalability and a responsive user experience.

- **Project Goals.md**  
  Describes the high-level goals and vision for the project, targeting a collaborative, multi-tenant SaaS platform for business analysts and planners, with pillars of accuracy, usability, collaboration, and performance.

- **Queue Processing & Job Management.md**  
  Details the backend job queue and worker system, including API-driven job creation, persistent storage in SQLite, asynchronous processing, and real-time status updates. **Recently enhanced with comprehensive UI improvements: model status table with row striping, status icons, progress bars, column distribution improvements, status alignment using flex containers, summary statistics, tabbed interface, real-time updates, batch management features, and improved action controls. The terminology for duplicate jobs is now 'Merged' (replacing 'Skipped'), with user-friendly banners, tooltips, and batch-level progress summaries reflecting this change.**

- **UI State Management & Data Flow.md**  
  Documents the evolution from "single source of truth" pattern to Zustand-based store architecture with automatic reactivity. **Covers the migration from prop drilling to centralized state management using multiple domain-specific stores (Model UI Store, SKU Store, Forecast Results Store), store integration patterns, component subscription patterns, debugging tools, and performance optimizations.**

- **Upload Wizard & Data Transformation.md**  
  Provides a technical breakdown of the CSV import process, including frontend and backend logic, AI-powered data transformation, deduplication, and the step-by-step workflow for importing and preparing data. **Recently enhanced with robust format validation, standardized error handling, progression blocking for validation errors, and consistent UI styling across all error states.**

- **useOptimization Hook Deprecation.md**  
  Documents the migration from the legacy `useOptimization` frontend hook to a backend-driven job queue, simplifying state management and aligning with the backend-first architecture.

- **Workflow Summary.md**  
  Summarizes the main steps of the application's workflow, from data upload and cleaning to forecasting and optimization, including recent UI/UX enhancements and troubleshooting tips. **Recently updated to reflect enhanced optimization queue UI, Zustand state management, CSV import validation improvements, data cleaning enhancements, and the new 'Merged' job status logic.**

- **Writing Effective AI Memory.md**  
  A guide for writing and maintaining high-quality documentation in the AI Memory folder, emphasizing the importance of explaining "why" decisions were made, linking to code, documenting gotchas, and keeping docs up to date.

- **Forecast System Improvements (2024-06)**  
  See: Forecast Methods & Parameter Persisten, UI State Management & Data Flow, Development Plans & Roadmap.  
  Documents model eligibility logic, modularized parameter controls with friendly labels, global forecast parameters integration, and improved state management.

- **CSV Separator Integration (2024-06)**  
  See: Data Cleaning Methods & Implementation, Upload Wizard & Data Transformation, Optimization Results Export System, Development Plans & Roadmap.  
  Documents the global CSV separator setting, backend/frontend sync, import/export logic, and testing scripts.

- **Dataset-Specific Export Feature (2024-06)**  
  See: Optimization Results Export System, Development Plans & Roadmap.  
  Documents the new dataset filtering toggle, backend filtering logic, and multi-dataset export support.

- **Dataset and SKU Filtering Implementation (2024-06)**  
  See: Dataset-SKU-Filtering, UI State Management & Data Flow, Optimization Results Export System, Development Plans & Roadmap.  
  Documents comprehensive filtering to ensure users only see results for currently loaded dataset and selected SKU, including backend API enhancements, frontend filtering logic, and export system integration.

- **Dataset Listing & Step Zero UX (2024-06)**  
  Documents the addition of a backend dataset listing/counting endpoint, enabling advanced Step Zero features: dataset gallery/selector, recent/favorites, metadata display, dataset health/status, bulk actions, search/filter, onboarding for new users, and future multi-dataset workflows.  
  See: Upload Wizard & Data Transformation, Workflow Summary, Development Plans & Roadmap. 

- **Modular Grid Search Implementation (2024-07)**  
  See: Forecasting Models & Architecture, Optimization Results Export System, Queue Processing & Job Management.  
  Documents the implementation of modular grid search where each model controls its own grid search behavior through `shouldIncludeInGridSearch()` and `getGridSearchParameters()` methods. Ensures all models (including non-optimizable ones like Linear Trend and Seasonal Naive) are always run and scored in grid search for fair comparison. **Covers the backend enhancement to extract and merge fitted ARIMA/SARIMA parameters into results after auto fitting, so exports and UI reflect true model configuration.**

- **ARIMA/SARIMA UI Improvements (2024-07)**  
  See: Forecasting Models & Architecture, UI State Management & Data Flow.  
  Documents the removal of "Auto ARIMA" toggle from UI, ensuring ARIMA and SARIMA show individual parameters (p, d, q, etc.) in both GRID and MANUAL modes. Grid search for ARIMA/SARIMA now only runs auto configuration, while manual mode allows parameter tuning. **CSV export shows fitted parameters instead of just 'auto' flag, with backend logic to extract and export p, d, q, P, D, Q, s after fitting.**

- **Model Score Display Enhancement (2024-07)**  
  See: UI State Management & Data Flow, Optimization Results Export System.  
  Documents the addition of composite scores to model cards in the UI, ensuring all models display their performance metrics prominently. Includes backend changes to ensure scores are properly mapped from optimization results to UI state, and frontend changes to display scores in ModelCard components.

- **Export Optimization Results Weight Integration (2024-07)**  
  See: Optimization Results Export System, Metric Weight Change Optimization Trigger.  
  Documents the fix to ensure CSV export uses current metric weights when determining "best result" instead of relying on stored weights from when jobs were completed. Includes recalculation of composite scores and best result determination using current weights passed from frontend.

- **Composite Score Normalization Fix (2024-07)**  
  See: Optimization Results Export System, Model Score Display Enhancement.  
  Documents the fix for negative normalized metric values in composite score calculations. The issue was that the backend calculated batch-relative max values for MAPE, RMSE, and MAE but then ignored them in favor of fixed thresholds (MAPE=100%, RMSE=1, MAE=1). This caused negative normalized values when actual metrics exceeded these fixed thresholds. The fix uses batch-relative max values for normalization and adds clamping to ensure normalized values stay within [0, 1] range, making composite scores more meaningful by reflecting relative performance within each dataset.

- **CSV Import Validation & Error Handling (2024-07)**  
  See: Upload Wizard & Data Transformation, Data Cleaning Methods & Implementation.  
  Documents comprehensive improvements to CSV import validation and error handling: strict format validation for dates and numbers, progression blocking when validation errors exist, standardized ErrorHandler component for consistent UI styling, visual error indicators in preview tables, column count validation to prevent separator mismatch, and helpful links for format assistance. **Ensures users cannot proceed with invalid data and provides clear guidance on how to fix issues.**

- **Optimization Queue UI Enhancements (2024-07)**  
  See: Queue Processing & Job Management, Workflow Summary, UI State Management & Data Flow.  
  Documents comprehensive UI improvements to the optimization queue system: enhanced model status table with row striping, status icons, progress bars, column distribution improvements, status alignment using flex containers, summary statistics cards, tabbed interface for different job states, real-time updates, batch management features, improved action controls for job management, and the new 'Merged' job status logic and terminology throughout the UI.

- **Zustand State Management Migration (2024-07)**  
  See: UI State Management & Data Flow, Workflow Summary.  
  Documents the complete migration from "single source of truth" pattern with prop drilling to Zustand-based store architecture with automatic reactivity. **Covers the implementation of multiple domain-specific stores (Model UI Store, SKU Store, Forecast Results Store), store integration patterns, component subscription patterns, debugging tools, performance optimizations, and the benefits of centralized state management.**

- **Known Issues & Gotchas.md**  
  (Placeholder) For recurring issues, troubleshooting tips, and backend/frontend gotchas. Add details as needed. 