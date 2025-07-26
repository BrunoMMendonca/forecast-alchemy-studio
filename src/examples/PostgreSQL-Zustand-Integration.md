# PostgreSQL + Zustand Integration with Pre-caching

## Overview

This implementation provides a robust architecture for handling large datasets by combining PostgreSQL for persistence with Zustand for client-side caching and pre-caching strategies.

## Architecture Benefits

### **PostgreSQL (Backend)**
- ✅ **Permanent storage** of all forecast data
- ✅ **Data integrity** with ACID transactions
- ✅ **Multi-user support** with proper authentication
- ✅ **Complex queries** and aggregations
- ✅ **Audit trails** and historical data
- ✅ **Scalability** for large datasets

### **Zustand (Frontend)**
- ✅ **Client-side caching** for instant UI updates
- ✅ **Pre-caching** for anticipated data needs
- ✅ **Memory management** with intelligent cleanup
- ✅ **Optimistic updates** for better UX
- ✅ **Real-time sync** with PostgreSQL

## Usage Examples

### 1. Basic Forecast Loading

```tsx
import { useForecastStore } from '@/store/forecastStore';

function ForecastComponent({ companyId, datasetIdentifier, sku, modelId }) {
  const { 
    forecast, 
    isLoading, 
    error, 
    hasForecast,
    loadForecastFromDatabase 
  } = useForecastStore(state => ({
    forecast: state.getForecast(companyId, datasetIdentifier, sku, modelId),
    isLoading: state.getIsLoading(companyId, datasetIdentifier, sku, modelId),
    error: state.getError(companyId, datasetIdentifier, sku, modelId),
    hasForecast: state.hasForecast(companyId, datasetIdentifier, sku, modelId),
    loadForecastFromDatabase: state.loadForecastFromDatabase
  }));

  useEffect(() => {
    if (!hasForecast && !isLoading) {
      loadForecastFromDatabase(companyId, datasetIdentifier, sku, modelId);
    }
  }, [companyId, datasetIdentifier, sku, modelId, hasForecast, isLoading]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!forecast) return <div>No forecast available</div>;

  return (
    <div>
      <h3>Forecast for {sku}</h3>
      <p>Model: {forecast.modelName}</p>
      <p>Methods: {forecast.methods.length}</p>
      {/* Render forecast data */}
    </div>
  );
}
```

### 2. Pre-caching for Large Datasets

```tsx
import { useForecastStore } from '@/store/forecastStore';

function DatasetView({ companyId, datasetIdentifier, skus, modelIds }) {
  const { preloadForecasts, setPreloadStrategy } = useForecastStore();

  // Configure pre-caching strategy
  useEffect(() => {
    setPreloadStrategy({
      enabled: true,
      maxConcurrent: 5, // Load 5 forecasts simultaneously
      batchSize: 20,    // Process 20 at a time
      priorityThreshold: 0.7,
      memoryLimit: 100  // 100MB memory limit
    });
  }, []);

  // Pre-cache forecasts when component mounts
  useEffect(() => {
    // Pre-cache all SKU/model combinations
    preloadForecasts(companyId, datasetIdentifier, skus, modelIds, 0.8);
  }, [companyId, datasetIdentifier, skus, modelIds]);

  return (
    <div>
      <h2>Dataset: {datasetIdentifier}</h2>
      {skus.map(sku => (
        <ForecastComponent 
          key={sku}
          companyId={companyId}
          datasetIdentifier={datasetIdentifier}
          sku={sku}
          modelId={modelIds[0]}
        />
      ))}
    </div>
  );
}
```

### 3. Batch Operations

```tsx
function BatchForecastManager({ companyId, datasetIdentifier }) {
  const { 
    getForecastsForSKUs,
    setForecastsForMultipleSKUs,
    getLoadingStatusForSKUs,
    setLoadingForMultipleSKUs
  } = useForecastStore();

  const skus = ['SKU001', 'SKU002', 'SKU003'];
  const modelIds = ['ARIMA', 'SARIMA', 'HoltWinters'];

  // Get all forecasts for multiple SKUs
  const forecasts = getForecastsForSKUs(companyId, datasetIdentifier, skus, modelIds);
  const loadingStatus = getLoadingStatusForSKUs(companyId, datasetIdentifier, skus, modelIds);

  const handleBatchGenerate = async () => {
    // Set loading state for all combinations
    setLoadingForMultipleSKUs(companyId, datasetIdentifier, skus, modelIds, true);

    try {
      // Generate forecasts in parallel
      const results = await Promise.all(
        skus.flatMap(sku => 
          modelIds.map(modelId => 
            generateForecast(companyId, datasetIdentifier, sku, modelId)
          )
        )
      );

      // Update store with all results
      const forecastUpdates = results.map((result, index) => {
        const skuIndex = Math.floor(index / modelIds.length);
        const modelIndex = index % modelIds.length;
        return {
          sku: skus[skuIndex],
          modelId: modelIds[modelIndex],
          forecast: result
        };
      });

      setForecastsForMultipleSKUs(companyId, datasetIdentifier, forecastUpdates);
    } catch (error) {
      console.error('Batch generation failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleBatchGenerate}>Generate All Forecasts</button>
      <div>
        {forecasts.map(({ sku, modelId, forecast }) => (
          <div key={`${sku}-${modelId}`}>
            {sku} - {modelId}: {forecast ? '✓' : '⏳'}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. Memory Management

```tsx
function CacheManager() {
  const { 
    cleanupCache, 
    cacheMetadata, 
    setPreloadStrategy,
    preloadStrategy 
  } = useForecastStore();

  // Monitor cache usage
  useEffect(() => {
    const interval = setInterval(() => {
      const totalMemory = Object.values(cacheMetadata)
        .reduce((sum, meta) => sum + meta.size, 0);
      
      const memoryMB = totalMemory / (1024 * 1024);
      
      if (memoryMB > preloadStrategy.memoryLimit * 0.8) {
        console.log('Cache cleanup triggered');
        cleanupCache();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [cacheMetadata, preloadStrategy.memoryLimit]);

  return (
    <div>
      <h3>Cache Status</h3>
      <p>Total entries: {Object.keys(cacheMetadata).length}</p>
      <p>Memory usage: {Object.values(cacheMetadata)
        .reduce((sum, meta) => sum + meta.size, 0) / (1024 * 1024)
        .toFixed(2)} MB</p>
      <button onClick={cleanupCache}>Manual Cleanup</button>
    </div>
  );
}
```

### 5. Real-time Sync Status

```tsx
function SyncStatusIndicator({ companyId, datasetIdentifier, sku, modelId }) {
  const { syncStatus, lastSyncTime } = useForecastStore();
  const cacheKey = `${companyId}-${datasetIdentifier}-${sku}-${modelId}`;
  
  const status = syncStatus[cacheKey];
  const lastSync = lastSyncTime[cacheKey];

  const getStatusColor = () => {
    switch (status) {
      case 'synced': return 'green';
      case 'syncing': return 'yellow';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div style={{ color: getStatusColor() }}>
      Status: {status || 'pending'}
      {lastSync && (
        <span> (Last sync: {new Date(lastSync).toLocaleTimeString()})</span>
      )}
    </div>
  );
}
```

## Performance Optimizations

### 1. **Intelligent Pre-caching**
- Pre-loads data based on user navigation patterns
- Prioritizes frequently accessed forecasts
- Automatically cleans up low-priority cached data

### 2. **Memory Management**
- Tracks memory usage of cached forecasts
- Automatically removes least-used data when memory limit is reached
- Configurable memory limits per dataset size

### 3. **Batch Operations**
- Loads multiple forecasts in parallel
- Reduces database round-trips
- Optimizes network usage

### 4. **Optimistic Updates**
- Updates UI immediately while syncing to database
- Provides instant feedback to users
- Handles sync failures gracefully

## Configuration

### Pre-caching Strategy
```ts
const preloadStrategy = {
  enabled: true,           // Enable/disable pre-caching
  maxConcurrent: 3,        // Max concurrent database requests
  batchSize: 10,          // Number of items to process per batch
  priorityThreshold: 0.5,  // Minimum priority for pre-caching
  memoryLimit: 50         // Memory limit in MB
};
```

### Database Schema
The PostgreSQL schema supports:
- **Companies**: Multi-tenant support
- **Datasets**: Organized data collections
- **SKUs**: Product identifiers
- **Models**: Forecasting algorithms
- **Forecasts**: Results with methods and periods
- **Optimization Jobs**: Background processing

## Best Practices

1. **Use pre-caching for large datasets** - Pre-load data users are likely to access
2. **Monitor memory usage** - Set appropriate memory limits
3. **Handle sync failures** - Provide fallback mechanisms
4. **Use batch operations** - Reduce database load
5. **Implement cleanup strategies** - Prevent memory leaks

## Migration from File-based Storage

The enhanced store maintains backward compatibility while providing:
- Automatic migration from file paths to dataset identifiers
- Gradual transition to PostgreSQL persistence
- Fallback to file-based storage if needed

This architecture scales from small test datasets to enterprise-level forecasting applications with thousands of SKUs and models. 