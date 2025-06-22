# How to Write Effective AI Memory

This document is a guide for AI assistants on how to create and maintain high-quality documentation in the `/AI Memory` folder. Following these guidelines will ensure that you and future AIs can quickly understand the project's architecture, history, and key implementation details.

## 1. The Goal of AI Memory

The primary goal of AI Memory is to **build a persistent, shared brain for the project**. Your context window is limited and will be lost. These documents are our long-term memory. They are the most critical tool for maintaining continuity and enabling effective collaboration over time.

A good AI Memory document allows any AI (or human) to answer the question: **"What was the reasoning behind this feature, and where is the code that implements it?"**

---

## 2. Core Principles for Writing

1.  **Focus on the "Why," Not Just the "What"**: Don't just summarize what the code does. Explain *why* it was built that way. What problem does it solve? What was the business or technical reason for this specific implementation?
    *   **Bad**: "The code adds jobs to a queue."
    *   **Good**: "To prevent the UI from freezing on large datasets, all optimization tasks are processed asynchronously. They are added to a global queue and processed sequentially in the background."

2.  **Be Specific and Link to Code**: Generalities are not helpful. Point directly to the key files, functions, and even specific state variables that are central to the feature. Use backticks for code formatting.
    *   **Bad**: "The component handles the upload."
    *   **Good**: "The entire workflow is managed by the `CsvImportWizard.tsx` component. The core logic for large file processing is in the `handleConfigProcessing` function."

3.  **Document the "Gotchas" and Historical Context**: The most valuable information is often the history of what *didn't* work. Documenting past failures and the reasoning for key decisions prevents future AIs from making the same mistakes.
    *   **Example**: "We initially tried to sort dates on the frontend using `Object.keys()`, but this proved unreliable because JavaScript object key order is not guaranteed. The final solution was to move sorting to the backend's `pivotTable` function and have it explicitly return a `columns` array."

4.  **Use Tables for Clarity**: Summary tables are excellent for providing a quick, at-a-glance overview of complex logic.

5.  **Keep it Up-to-Date**: If you change a feature, update its corresponding AI Memory document. An outdated document is worse than no document.

---

## 3. The "Perfect AI Memory" Template

Use this template as a starting point for all new documents.

```markdown
# [Feature Name]: A Technical Guide

*A one-sentence summary of what this document covers.*

## 1. Core Problem / Use Case

*Explain the "why." What user story or technical problem does this feature solve? What were the key requirements?*

---

## 2. How it Works (Architectural Flow)

*Describe the end-to-end flow of data and user interaction. How do the different components (frontend, backend, database, workers) interact? Use a numbered or bulleted list for clarity.*

### A. Frontend Logic

*Describe the key React components, hooks, and state variables involved.*

### B. Backend Logic

*Describe the key API endpoints, data transformations, and algorithms used.*

---

## 3. Key Code Pointers

*Provide direct links to the most important files and functions. This is the "where."*

| Area              | File / Component               | Key Function / Hook           | Purpose                                      |
| ----------------- | ------------------------------ | ----------------------------- | -------------------------------------------- |
| **User Interface**| `src/components/Component.tsx` | `renderContent`               | Renders the main UI.                         |
| **State Mgmt**    | `src/hooks/useHook.ts`         | `useState`, `useCallback`     | Manages the feature's state.                 |
| **API Endpoint**  | `backend-server-example.cjs`   | `app.post('/api/endpoint')`   | Handles the request from the frontend.       |
| **Core Algorithm**| `src/utils/algorithm.ts`       | `runAlgorithm()`              | Contains the core business/computation logic.|

---

## 4. "Gotchas" & Historical Context

*This is the most important section. What was tried and failed? What are the non-obvious dependencies or potential pitfalls? Why was a key decision made a certain way?*

- **Gotcha 1**: *Example: The API for this feature requires an ISO 8601 formatted date string; sending a Unix timestamp will cause a silent failure.*
- **Decision 1**: *Example: We chose to use Web Workers over a full backend for this feature to solve UI freezing quickly without incurring server costs.*

```

---

## 4. Reference Example

For a real-world example of a well-written document, please review **`AI Memory/Upload Wizard & Data Transformation.md`**. It follows all the principles outlined above. 