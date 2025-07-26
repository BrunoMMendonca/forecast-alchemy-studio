# Dataset Identifier to Dataset ID Migration Guide

## Overview
This migration converts the application from using `datasetIdentifier` (string format like "dataset_15") to `datasetId` (integer format like 15) throughout the entire stack.

## What Changed

### Frontend Changes ✅
- **Store Layer**: `src/store/forecastStore.ts` - All functions now use `datasetId: number`
- **Components**: All components updated to use `datasetId` instead of `datasetIdentifier`
- **Hooks**: `useBestResultsMapping` and other hooks updated
- **Pages**: `ForecastPage.tsx`, `WorkflowPage.tsx` updated

### Backend Changes ✅
- **Routes**: `src/backend/routes.js` - API endpoints use `datasetId`
- **Worker**: `src/backend/worker.js` - Job processing uses `datasetId`
- **Database**: `src/backend/db.js` - Functions updated
- **Utils**: `src/backend/utils.js` - Helper functions updated

### Database Changes 🔄
- **Schema**: `optimization_jobs` table will be cleaned up
- **Data**: Existing `dataset_identifier` values migrated to `dataset_id`
- **Indexes**: String index removed, integer index used

## Migration Steps

### 1. Database Migration
```bash
# Run the migration script in your database
psql -d your_database -f migrate-dataset-identifier-to-dataset-id.sql
```

### 2. Verify Migration
The migration script will show:
- Current state before migration
- Number of records updated
- Final state after migration
- Any orphaned records

### 3. Test Application
1. Start the backend server
2. Start the frontend application
3. Test dataset upload and processing
4. Test optimization jobs
5. Test forecast generation

## Benefits

### Performance Improvements
- **Faster Queries**: Integer comparisons vs string comparisons
- **Smaller Indexes**: Integer indexes are much smaller
- **Better Joins**: Direct integer foreign key relationships
- **Reduced Storage**: No duplicate data

### Code Quality
- **Type Safety**: Better TypeScript support with proper number types
- **Consistency**: Unified approach across frontend and backend
- **Maintainability**: Cleaner code without string parsing

## Rollback Plan

If issues occur, use the rollback script:
```bash
psql -d your_database -f rollback-dataset-migration.sql
```

## Files Modified

### Frontend Files
- `src/store/forecastStore.ts`
- `src/pages/ForecastPage.tsx`
- `src/pages/WorkflowPage.tsx`
- `src/components/StepContent.tsx`
- `src/components/OptimizationResultsExporter.tsx`
- `src/components/forecast-wizard/FinalizeStep.tsx`
- `src/components/forecast-wizard/ReusableForecastChart.tsx`
- `src/components/forecast-wizard/EnhancedModelDiagnosticChart.tsx`
- `src/components/forecast-wizard/ChartModal.tsx`
- `src/components/FloatingSettingsButton.tsx`
- `src/components/DataVisualization.tsx`
- `src/hooks/useBestResultsMapping.ts`

### Backend Files
- `src/backend/routes.js`
- `src/backend/worker.js`
- `src/backend/utils.js`
- `src/backend/db.js`

### Database Files
- `migrate-dataset-identifier-to-dataset-id.sql`
- `rollback-dataset-migration.sql`

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] No orphaned records after migration
- [ ] Dataset upload works
- [ ] Optimization jobs create successfully
- [ ] Forecast generation works
- [ ] Chart display works
- [ ] Export functionality works
- [ ] All existing data preserved

## Troubleshooting

### Common Issues

1. **Migration Fails**: Check for invalid `dataset_identifier` values
2. **Orphaned Records**: Review and clean up before migration
3. **Foreign Key Violations**: Ensure all `dataset_id` values reference valid datasets

### Support
If you encounter issues:
1. Check the migration script output for errors
2. Verify database constraints
3. Use the rollback script if needed
4. Review application logs for errors

## Migration Complete ✅

The application now uses `datasetId` (integer) consistently throughout the entire stack, providing better performance and type safety. 