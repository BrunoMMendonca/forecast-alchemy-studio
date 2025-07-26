# Enhanced S&OP Cycle Configuration System

## Overview

The enhanced S&OP (Sales & Operations Planning) cycle system provides automatic cycle generation with frequency-based naming, cut-off periods, and hierarchical structure support. This system replaces the manual cycle creation with a sophisticated configuration-driven approach.

## Key Features

### 🎯 **Automatic Cycle Generation**
- Cycles are created automatically based on frequency and start parameters
- No manual naming required - cycles are named by period (e.g., "January 2024", "Q1 2024")
- Support for weekly, monthly, quarterly, and yearly frequencies

### 🏢 **Hierarchical Structure**
- **Company-wide cycles**: Apply to all divisions
- **Division-specific cycles**: Different cycles per division
- Multiple configurations can coexist (e.g., monthly company-wide + weekly division-specific)

### ⏰ **Cut-off Periods**
- Configurable cut-off periods before cycle end
- Regular users cannot modify forecasts during cut-off periods
- Manager override capabilities with permission system

### 🔄 **Auto-generation**
- Automatic creation of new cycles as time progresses
- Configurable generation parameters (start date, count)
- Real-time cycle status tracking

## Database Schema

### Core Tables

#### `sop_cycle_configs` - Configuration Templates
```sql
CREATE TABLE sop_cycle_configs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    division_id INTEGER REFERENCES divisions(id), -- NULL for company-wide
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
    start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12), -- For quarterly/yearly
    cut_off_days INTEGER NOT NULL DEFAULT 3 CHECK (cut_off_days >= 0 AND cut_off_days <= 30),
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    auto_generate BOOLEAN DEFAULT TRUE,
    generate_from_date DATE NOT NULL,
    generate_count INTEGER NOT NULL DEFAULT 12 CHECK (generate_count >= 1 AND generate_count <= 60),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, frequency) -- One config per division per frequency
);
```

#### `sop_cycles` - Generated Cycles
```sql
CREATE TABLE sop_cycles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    division_id INTEGER REFERENCES divisions(id), -- NULL for company-wide
    config_id INTEGER REFERENCES sop_cycle_configs(id), -- Which config generated this cycle
    name TEXT NOT NULL, -- Auto-generated name like "January 2024", "Q1 2024"
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cut_off_date DATE NOT NULL, -- When regular users can no longer modify forecasts
    is_current BOOLEAN DEFAULT FALSE, -- Only one current cycle per division
    is_completed BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(company_id, division_id, name), -- Unique name per division
    UNIQUE(company_id, division_id, start_date) -- No overlapping cycles
);
```

#### `sop_cycle_permissions` - Permission Management
```sql
CREATE TABLE sop_cycle_permissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'approve', 'admin')),
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMPTZ, -- Optional expiration
    UNIQUE(cycle_id, user_id, permission_type)
);
```

#### `sop_cycle_audit_log` - Audit Trail
```sql
CREATE TABLE sop_cycle_audit_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    cycle_id INTEGER NOT NULL REFERENCES sop_cycles(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

## API Endpoints

### Configuration Management

#### `GET /api/sop-cycle-configs`
Retrieve S&OP cycle configurations for the company.

**Query Parameters:**
- `divisionId` (optional): Filter by specific division

**Response:**
```json
{
  "status": "ok",
  "configs": [
    {
      "id": 1,
      "company_id": 1,
      "division_id": null,
      "frequency": "monthly",
      "start_day": 1,
      "start_month": null,
      "cut_off_days": 3,
      "is_active": true,
      "description": "Monthly S&OP cycles",
      "auto_generate": true,
      "generate_from_date": "2024-01-01",
      "generate_count": 12,
      "division_name": null
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `POST /api/sop-cycle-configs`
Create a new S&OP cycle configuration.

**Request Body:**
```json
{
  "divisionId": null,
  "frequency": "monthly",
  "startDay": 1,
  "startMonth": null,
  "cutOffDays": 3,
  "description": "Monthly S&OP cycles starting on the 1st",
  "autoGenerate": true,
  "generateFromDate": "2024-01-01",
  "generateCount": 12
}
```

#### `POST /api/sop-cycle-configs/:configId/generate`
Generate S&OP cycles from a configuration.

**Response:**
```json
{
  "status": "ok",
  "message": "Generated 12 S&OP cycles",
  "cyclesCreated": 12,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Cycle Management

#### `GET /api/sop-cycles`
Retrieve S&OP cycles with enhanced information.

**Query Parameters:**
- `divisionId` (optional): Filter by division
- `status` (optional): Filter by status
- `current` (optional): Filter current cycles only

**Response:**
```json
{
  "status": "ok",
  "cycles": [
    {
      "id": 1,
      "company_id": 1,
      "division_id": null,
      "config_id": 1,
      "name": "January 2024",
      "description": null,
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "cut_off_date": "2024-01-28",
      "is_current": true,
      "is_completed": false,
      "status": "active",
      "cycle_status": "active",
      "division_name": null,
      "config_frequency": "monthly"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `PUT /api/sop-cycles/:cycleId/status`
Update S&OP cycle status.

**Request Body:**
```json
{
  "status": "active",
  "isCurrent": true
}
```

### Permission Management

#### `GET /api/sop-cycles/:cycleId/permissions`
Get permissions for a specific cycle.

#### `POST /api/sop-cycles/:cycleId/permissions`
Grant permission for a cycle.

**Request Body:**
```json
{
  "userId": 1,
  "permissionType": "edit",
  "expiresAt": "2024-12-31"
}
```

## Frontend Integration

### Store Methods

The Zustand store provides comprehensive methods for S&OP cycle management:

```typescript
// Configuration management
loadSopCycleConfigs(): Promise<void>
createSopCycleConfig(config: Omit<SopCycleConfig, 'id' | 'companyId'>): Promise<void>
updateSopCycleConfig(id: number, config: Partial<SopCycleConfig>): Promise<void>
deleteSopCycleConfig(id: number): Promise<void>
generateSopCycles(configId: number): Promise<void>

// Cycle management
loadSopCycles(): Promise<void>
createSopCycle(cycle: Omit<SopCycle, 'id' | 'companyId'>): Promise<void>
updateSopCycleStatus(id: number, status: string, isCurrent?: boolean): Promise<void>

// Permission management
loadSopCyclePermissions(cycleId: number): Promise<void>
grantSopCyclePermission(cycleId: number, userId: number, permissionType: string, expiresAt?: string): Promise<void>
revokeSopCyclePermission(cycleId: number, userId: number, permissionType: string): Promise<void>
```

### UI Components

The enhanced `SopCyclesStep` component provides:

1. **Configuration Form**: Create and edit S&OP cycle configurations
2. **Preview Panel**: Real-time preview of generated cycles
3. **Existing Configurations**: View and manage existing configurations
4. **Scope Selection**: Choose between company-wide and division-specific
5. **Frequency Settings**: Configure weekly, monthly, quarterly, or yearly cycles
6. **Cut-off Periods**: Set when regular users can no longer modify forecasts

## Usage Examples

### Monthly Company-wide Cycles
```json
{
  "divisionId": null,
  "frequency": "monthly",
  "startDay": 1,
  "cutOffDays": 3,
  "description": "Monthly S&OP cycles starting on the 1st",
  "autoGenerate": true,
  "generateFromDate": "2024-01-01",
  "generateCount": 12
}
```

**Generated Cycles:**
- January 2024: 2024-01-01 to 2024-01-31 (cut-off: 2024-01-28)
- February 2024: 2024-02-01 to 2024-02-29 (cut-off: 2024-02-26)
- March 2024: 2024-03-01 to 2024-03-31 (cut-off: 2024-03-28)
- ...

### Weekly Division-specific Cycles
```json
{
  "divisionId": 1,
  "frequency": "weekly",
  "startDay": 1,
  "cutOffDays": 2,
  "description": "Weekly S&OP cycles for Division A",
  "autoGenerate": true,
  "generateFromDate": "2024-01-01",
  "generateCount": 8
}
```

**Generated Cycles:**
- Week 1 2024: 2024-01-01 to 2024-01-07 (cut-off: 2024-01-05)
- Week 2 2024: 2024-01-08 to 2024-01-14 (cut-off: 2024-01-12)
- Week 3 2024: 2024-01-15 to 2024-01-21 (cut-off: 2024-01-19)
- ...

### Quarterly Cycles
```json
{
  "divisionId": null,
  "frequency": "quarterly",
  "startDay": 1,
  "startMonth": 1,
  "cutOffDays": 5,
  "description": "Quarterly S&OP cycles starting in January",
  "autoGenerate": true,
  "generateFromDate": "2024-01-01",
  "generateCount": 4
}
```

**Generated Cycles:**
- Q1 2024: 2024-01-01 to 2024-03-31 (cut-off: 2024-03-26)
- Q2 2024: 2024-04-01 to 2024-06-30 (cut-off: 2024-06-25)
- Q3 2024: 2024-07-01 to 2024-09-30 (cut-off: 2024-09-25)
- Q4 2024: 2024-10-01 to 2024-12-31 (cut-off: 2024-12-26)

## Business Logic

### Cycle Status Calculation
The system automatically calculates cycle status based on current date:

- **Upcoming**: `start_date > CURRENT_DATE`
- **Active**: `start_date <= CURRENT_DATE AND end_date > CURRENT_DATE`
- **Locked**: `cut_off_date <= CURRENT_DATE`
- **Completed**: `end_date <= CURRENT_DATE`

### Permission Enforcement
During cut-off periods:
1. Regular users cannot modify forecasts
2. Only users with explicit permissions can make changes
3. All changes are logged in the audit trail
4. Managers can override with appropriate permissions

### Auto-generation Logic
1. System checks for active configurations
2. Generates new cycles based on frequency and parameters
3. Ensures no overlapping cycles
4. Maintains unique naming conventions
5. Updates current cycle status

## Testing

Use the provided test script to verify the system:

```bash
node test-sop-cycle-config.js
```

This script tests:
- Configuration creation and retrieval
- Cycle generation
- Status updates
- Permission management
- Division-specific configurations
- Different frequency types

## Migration from Old System

The enhanced system is backward compatible. Existing S&OP cycles will continue to work, but new configurations will use the enhanced features.

To migrate:
1. Run the database schema migration
2. Update the frontend components
3. Test with the provided test script
4. Gradually migrate existing cycles to configurations

## Future Enhancements

Potential future features:
- **Recurring Patterns**: More complex cycle patterns
- **Holiday Adjustments**: Automatic holiday date adjustments
- **Notification System**: Alerts for cut-off periods
- **Advanced Permissions**: Role-based access control
- **Cycle Templates**: Predefined configuration templates
- **Integration APIs**: Connect with external planning systems 
 
 
 
 
 
 
 
 
 