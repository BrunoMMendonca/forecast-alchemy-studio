# New Role-Based Access Control System

## Overview

The system has been updated with a sophisticated role-based access control (RBAC) system that provides granular permissions based on company hierarchy and user responsibilities.

## Role Hierarchy

### 1. **company_admin** (formerly admin/owner)
- **Full system access** - can do everything
- **User management**: Can invite new users and assign roles
- **Company management**: Can create/modify companies, divisions, clusters
- **Setup wizard access**: Full access to all setup features
- **Data access**: Access to all data across the company

### 2. **division_admin** (formerly manager)
- **Division-level admin** with user assignment capabilities
- **User assignment**: Can assign existing users to their divisions
- **Division management**: Can manage divisions assigned to them
- **No setup wizard**: Cannot use the setup wizard (restricted)
- **Data access**: Access to data within their assigned divisions

### 3. **cluster_admin** (new role)
- **Cluster-level admin** - starts at CSV import level
- **CSV import**: Can import and manage CSV data
- **S&OP cycles**: Can generate new S&OP cycles
- **Cluster management**: Can manage clusters assigned to them
- **Data access**: Access to data within their assigned clusters

### 4. **analyst** (unchanged)
- **Data cleaning and analysis** only
- **No CSV import**: Cannot import new CSV files
- **Visibility starts at data cleaning**: Can work with cleaned data
- **Multiple assignments**: Can be assigned to multiple divisions/clusters
- **Analysis tools**: Full access to forecasting and analysis features

### 5. **viewer** (unchanged)
- **Read-only access** to assigned data
- **No modification rights**: Cannot modify any data
- **Multiple assignments**: Can be assigned to multiple divisions/clusters

## User Creation Process

### New Process (Admin-Only)
1. **Only company admins can create users**
2. **Invitation system**: Admins create invitations with pre-assigned roles
3. **Email invitations**: Users receive email with temporary password
4. **Role pre-assignment**: Roles are assigned during invitation creation
5. **No role = no visibility**: Users without roles can register but have no access

### Registration Flow
1. **Admin creates invitation** with email, username, and assigned roles
2. **User receives email** with invitation token and temporary password
3. **User accepts invitation** by setting a new password
4. **User is created** with pre-assigned roles and permissions
5. **User can immediately log in** and access assigned resources

## Database Schema Changes

### New Tables
- **user_invitations**: Stores pending user invitations
- **Updated user_roles**: Now supports division_id and cluster_id for granular access

### Updated Constraints
- **Role types**: Updated to support new role hierarchy
- **Division/Cluster access**: Users can be assigned to specific divisions/clusters
- **Invitation system**: Supports temporary passwords and role pre-assignment

## API Endpoints

### New Endpoints
- `POST /api/auth/invite` - Create user invitation (company_admin only)
- `POST /api/auth/invite/accept` - Accept user invitation
- `GET /api/auth/invitations` - Get company invitations (company_admin only)

### Updated Endpoints
- All existing endpoints now use new role-based authorization
- Company creation requires admin privileges
- Division/Cluster access is enforced

## Authorization Middleware

### New Middleware Functions
- `requireRole(allowedRoles)` - Generic role-based authorization
- `requireCompanyAdmin()` - Company admin only
- `requireDivisionAdmin()` - Division admin or higher
- `requireClusterAdmin()` - Cluster admin or higher
- `requireAnalyst()` - Analyst or higher
- `requireViewer()` - Viewer or higher
- `requireDivisionAccess(divisionId)` - Division-specific access
- `requireClusterAccess(clusterId)` - Cluster-specific access

## Migration Guide

### Database Migration
1. Run `migrate-to-new-roles.sql` to update existing database
2. Existing users will be migrated to new role system
3. Test users updated with new role assignments

### Testing
1. Run `test-new-role-system.js` to verify role permissions
2. Test each user type with their expected permissions
3. Verify that analysts cannot create companies or invite users

## Security Benefits

1. **Principle of Least Privilege**: Users only get access they need
2. **Granular Control**: Division and cluster-level access control
3. **Admin-Only User Creation**: Prevents unauthorized user creation
4. **Role Pre-Assignment**: Ensures users have proper permissions from start
5. **Audit Trail**: All user creation and role assignments are tracked

## User Experience

### For Admins
- **User Management Dashboard**: Easy invitation creation and role assignment
- **Role Assignment Wizard**: Visual interface for assigning users to divisions/clusters
- **Invitation Tracking**: Monitor pending and accepted invitations

### For Users
- **Clear Permissions**: Users know exactly what they can access
- **Immediate Access**: No waiting for role assignment after registration
- **Multiple Assignments**: Can work across multiple divisions/clusters

## Implementation Status

✅ **Database Schema**: Updated with new tables and constraints
✅ **Authorization Middleware**: New role-based system implemented
✅ **User Invitation System**: Complete invitation flow
✅ **API Endpoints**: New and updated endpoints ready
✅ **Migration Script**: Database migration script created
✅ **Test Script**: Comprehensive role testing available

🔄 **Frontend Updates**: User management interface needed
🔄 **Email Service**: Invitation email sending needs implementation
🔄 **Role Assignment Wizard**: UI for assigning users to divisions/clusters

## Next Steps

1. **Run migration script** to update existing database
2. **Test role permissions** with the test script
3. **Update frontend** to support new user invitation system
4. **Implement email service** for sending invitations
5. **Create role assignment wizard** for admin interface 