# Migration Guide: Rename `jobs` Table to `optimization_jobs`

## Overview

The `jobs` table is being renamed to `optimization_jobs` to better reflect its purpose. This table stores optimization jobs for forecasting models, not generic jobs, so the name should be more descriptive.

## Why This Change?

- **Clarity**: `jobs` is too generic and doesn't indicate what type of jobs
- **Purpose**: The table specifically stores optimization jobs for forecasting models
- **Maintainability**: Better naming makes the codebase more self-documenting
- **Scalability**: If we add other job types in the future, this avoids confusion

## Migration Steps

### 1. Database Migration

Run the SQL migration script:

```bash
# For PostgreSQL
psql -d your_database_name -f rename-jobs-table.sql

# Or connect to your database and run the SQL directly
```

The migration script will:
- Rename the table from `jobs` to `optimization_jobs`
- Update foreign key constraints in the `forecasts` table
- Rename indexes to match the new table name
- Add helpful comments to document the table's purpose

### 2. Backend Code Updates

Run the backend update script:

```bash
node update-backend-references.js
```

This will update:
- `src/backend/routes.js` - All SQL queries and API endpoints
- `src/backend/worker.js` - Worker process queries
- `src/backend/init-postgres-schema.sql` - Schema definition

### 3. Test Files Updates

Run the test files update script:

```bash
node update-test-files.js
```

This will update all utility scripts and test files:
- `test-skipped-jobs.js`
- `test-optimization-jobs.js`
- `simple-check.js`
- `check-jobs.cjs`
- `debug-batchid.js`
- `check-db-schema.js`
- `add-batchid-column.cjs`
- `add-updatedat-column.js`
- `update-existing-jobs.js`
- `fix-skipped-jobs.cjs`

### 4. Restart Services

After the migration:

```bash
# Restart your backend server
npm run dev
# or however you start your backend
```

### 5. Verification

Test the following to ensure the migration worked:

1. **Database**: Check that the table was renamed
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_name = 'optimization_jobs';
   ```

2. **API Endpoints**: Test optimization job creation and status endpoints
   - `POST /api/jobs` - Create optimization jobs
   - `GET /api/jobs/status` - Get job status
   - `GET /api/optimizations/status` - Get optimization status

3. **Frontend**: Verify that the optimization queue and job management still work

## Rollback Plan

If something goes wrong, you can rollback:

```sql
-- Rollback SQL
ALTER TABLE optimization_jobs RENAME TO jobs;
ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_job_id_fkey;
ALTER TABLE forecasts ADD CONSTRAINT forecasts_job_id_fkey 
    FOREIGN KEY (job_id) REFERENCES jobs(id);
DROP INDEX IF EXISTS idx_optimization_jobs_company_status;
CREATE INDEX idx_jobs_company_status ON jobs (company_id, status);
```

Then restore the original code files from git.

## What Changed

### Database Schema
- Table name: `jobs` → `optimization_jobs`
- Index name: `idx_jobs_company_status` → `idx_optimization_jobs_company_status`
- Added helpful comments to document the table's purpose

### Backend Code
- All SQL queries updated to use `optimization_jobs`
- Error messages updated to be more specific
- API endpoint logic remains the same, just table name changes

### Test Files
- All utility scripts updated to use the new table name
- Log messages updated for clarity

## Benefits After Migration

1. **Clearer Code**: Anyone reading the code immediately knows what the table is for
2. **Better Documentation**: The table name is self-documenting
3. **Future-Proof**: If we add other job types (e.g., data processing jobs), there won't be confusion
4. **Professional**: More professional and maintainable codebase

## Notes

- The migration is backward-compatible in terms of functionality
- All existing data is preserved
- API endpoints remain the same (only internal table names change)
- Frontend code doesn't need changes since it uses API endpoints

## Troubleshooting

If you encounter issues:

1. **Foreign Key Errors**: Make sure the migration script ran completely
2. **API Errors**: Check that the backend code was updated and server restarted
3. **Test Failures**: Ensure test files were updated
4. **Data Loss**: The migration doesn't delete data, but always backup before major changes

## Support

If you need help with the migration, check:
1. Database logs for SQL errors
2. Backend logs for API errors
3. Test the application thoroughly after migration 