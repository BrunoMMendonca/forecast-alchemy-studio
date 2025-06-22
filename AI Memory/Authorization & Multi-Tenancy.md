# Authorization & Multi-Tenancy Architecture

This document outlines the architecture for transforming the application into a professional-grade, multi-tenant, and collaborative platform.

## 1. Core Concepts

-   **Organizations**: The primary entity for data ownership. All data (datasets, forecasts, etc.) belongs to an organization.
-   **Users**: Users belong to one and only one organization.
-   **Roles**: Users have a role within their organization that defines their permissions.
-   **Multi-Tenancy**: The system is designed so that one organization's data is completely isolated and invisible to another.

## 2. Roles and Permissions

The system will start with three basic roles:

| Role      | Permissions                                                                        |
| :-------- | :--------------------------------------------------------------------------------- |
| **Admin** | - Can invite and manage users within the organization.<br>- Can manage billing and subscription.<br>- Has all `Editor` permissions. |
| **Editor**| - Can upload, create, clean, and modify datasets and forecasts.<br>- Can view all organization data.<br>- Cannot manage users or billing. |
| **Viewer**| - Can only view datasets and forecasts.<br>- Cannot make any changes.                |

## 3. Database Schema

To support this model, the following database changes are required:

1.  **`organizations` Table**:
    -   `id` (PK)
    -   `name` (UNIQUE)
    -   `createdAt`

2.  **`users` Table**:
    -   Add `organizationId` (FK to `organizations.id`)
    -   Add `role` (e.g., 'ADMIN', 'EDITOR', 'VIEWER')

3.  **Data Tables (e.g., `datasets`, `forecasts`)**:
    -   Will be linked to `organizationId` instead of `userId`.

## 4. Backend API & Logic

-   **User Registration**: The registration flow will now include creating or joining an organization. The first user to register an organization becomes its Admin.
-   **Authentication**: The JWT issued upon login must contain the `userId`, `organizationId`, and `role`.
-   **Authorization Middleware**: All data-access API endpoints must be protected by a new authorization middleware. This middleware will:
    1.  Verify the JWT.
    2.  Extract the `organizationId` and `role` from the token.
    3.  Check if the requested resource belongs to the user's organization.
    4.  Check if the user's role grants them permission for the requested action (e.g., an `Editor` can `POST` to `/api/datasets`, but a `Viewer` cannot).

## 5. Frontend Changes

-   The UI will need to be updated to manage users (for Admins).
-   State management hooks will need to be aware of the user's role to conditionally render UI elements (e.g., hide the "Upload" button for Viewers).
-   All API `fetch` calls will need to include the JWT in the `Authorization` header.

This architecture provides a robust foundation for building a secure, scalable, and collaborative forecasting platform. 