# Organization Structure Configuration Storage Strategy

## Overview

This document outlines the strategy for storing and managing organization structure configurations in the Forecast Alchemy Studio application. The goal is to ensure that when users return to the setup wizard, their previous organizational structure settings are preserved and loaded automatically.

## Problem Statement

Previously, organization structure configurations (like `hasMultipleDivisions`, `hasMultipleClusters`, `importLevel`, etc.) were only stored in the Zustand state, which is temporary and lost when the user refreshes the page or returns to the setup wizard later.

## Solution Strategy

### Option 1: Extend `company_settings` table (Implemented)

**Why this approach:**
- ✅ Follows existing patterns in the codebase
- ✅ Leverages existing `company_settings` table structure
- ✅ Simple key-value storage with JSON support
- ✅ Already has proper indexing and constraints
- ✅ Consistent with other application settings

**Implementation Details:**

#### Database Storage
```sql
-- Uses existing company_settings table
INSERT INTO company_settings (company_id, key, value, updated_by)
VALUES ($1, 'organization_structure_config', $2, $3)
ON CONFLICT (company_id, key)
DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3
```

#### Configuration Structure
```typescript
interface OrganizationStructureConfig {
  hasMultipleDivisions: boolean;
  hasMultipleClusters: boolean;
  importLevel: 'company' | 'division' | null;
  csvUploadType: 'perCompany' | 'perDivision' | null;
  divisionCsvType: 'withDivisionColumn' | 'withoutDivisionColumn' | null;
  setupFlow: {
    skipDivisionStep: boolean;
    skipClusterStep: boolean;
    divisionValue: string | null;
    clusterValue: string | null;
    requiresCsvUpload: boolean;
    csvStructure: {
      hasDivisionColumn: boolean;
      hasClusterColumn: boolean;
    };
  };
}
```

#### API Endpoints
- `GET /api/organization-structure-config` - Load configuration
- `POST /api/organization-structure-config` - Save configuration

#### Frontend Integration
- **Auto-loading**: Configuration is loaded when the setup wizard initializes
- **Auto-saving**: Configuration is saved automatically when changes are made (with debouncing)
- **Persistence**: Configuration is saved when setup is completed

## Alternative Options Considered

### Option 2: Dedicated `organization_structure_config` table
```sql
CREATE TABLE organization_structure_config (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  has_multiple_divisions BOOLEAN NOT NULL,
  has_multiple_clusters BOOLEAN NOT NULL,
  import_level TEXT NOT NULL,
  csv_upload_type TEXT,
  division_csv_type TEXT,
  setup_flow JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by INTEGER REFERENCES users(id)
);
```

**Pros:**
- More normalized structure
- Type-safe columns
- Better query performance for specific fields

**Cons:**
- Adds complexity to schema
- Requires migration
- Less flexible for future changes

### Option 3: Store in `companies` table
```sql
ALTER TABLE companies ADD COLUMN org_structure_config JSONB;
```

**Pros:**
- Simple one-to-one relationship
- No additional table needed

**Cons:**
- Mixes company data with configuration
- Less flexible for complex configurations
- Harder to version and audit

## Implementation Details

### Backend Changes

1. **New API Endpoints** (`src/backend/routes.js`):
   - `GET /organization-structure-config` - Returns saved configuration or defaults
   - `POST /organization-structure-config` - Saves configuration with validation

2. **Validation**:
   - Required fields: `hasMultipleDivisions`, `hasMultipleClusters`, `importLevel`
   - JSON structure validation
   - Company ownership verification

### Frontend Changes

1. **Store Updates** (`src/store/setupWizardStore.ts`):
   - `loadOrgStructureConfig()` - Loads configuration from API
   - `saveOrgStructureConfig()` - Saves configuration to API
   - Auto-loading in `loadAllData()`

2. **Component Updates** (`src/components/SetupWizard/steps/OrganizationStructureStep.tsx`):
   - Auto-save on configuration changes (debounced)
   - Preserves pending data during configuration updates

3. **Setup Completion**:
   - Configuration is saved when setup is completed
   - Ensures final state is persisted

## Data Flow

```mermaid
graph TD
    A[User opens Setup Wizard] --> B[loadAllData()]
    B --> C[loadOrgStructureConfig()]
    C --> D[Load from company_settings]
    D --> E[Merge with existing state]
    E --> F[User modifies configuration]
    F --> G[Debounced saveOrgStructureConfig()]
    G --> H[Save to company_settings]
    I[User completes setup] --> J[saveOrgStructureConfig()]
    J --> K[Final configuration saved]
```

## Benefits

1. **Persistence**: Configurations survive page refreshes and return visits
2. **Consistency**: Follows existing patterns in the codebase
3. **Flexibility**: JSON storage allows for future configuration additions
4. **Performance**: Simple key-value lookup with proper indexing
5. **Audit Trail**: Tracks who updated the configuration and when

## Migration Strategy

Since we're using the existing `company_settings` table, no database migration is required. The new configuration will be automatically created when users first interact with the organization structure step.

## Testing

1. **Unit Tests**: Test API endpoints with various configurations
2. **Integration Tests**: Test full setup wizard flow with configuration persistence
3. **Manual Testing**: Verify configuration persists across browser sessions

## Future Considerations

1. **Configuration Versioning**: Add version field for backward compatibility
2. **Configuration Templates**: Pre-defined configurations for common organizational structures
3. **Configuration Export/Import**: Allow users to share configurations
4. **Configuration Validation**: More sophisticated validation rules based on business logic

## Conclusion

The implemented solution using the `company_settings` table provides the best balance of simplicity, consistency, and flexibility. It follows existing patterns in the codebase while providing the necessary persistence for organization structure configurations. 
 
 
 
 
 
 
 
 
 