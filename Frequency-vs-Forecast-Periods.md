# Frequency vs Forecast Periods - Architecture Guide

## **🔍 Key Distinction**

### **Frequency (Dataset-Specific)**
- **Purpose**: Determines how often data points occur
- **Storage**: `datasets.metadata.summary.frequency`
- **Usage**: Calculates seasonal periods for seasonal models
- **Scope**: Per dataset (each dataset can have different frequency)

### **Forecast Periods (Global Settings)**
- **Purpose**: How many periods to forecast into the future
- **Storage**: `settings.global_forecastPeriods`
- **Usage**: How far ahead to predict
- **Scope**: Global user preference (applies to all forecasts)

## **📊 Examples**

### **Dataset Frequency Examples:**
```javascript
// Dataset A: Monthly sales data
frequency: 'monthly' → seasonalPeriods: 12

// Dataset B: Weekly inventory data  
frequency: 'weekly' → seasonalPeriods: 52

// Dataset C: Daily temperature data
frequency: 'daily' → seasonalPeriods: 7
```

### **Global Forecast Periods Examples:**
```javascript
// User wants to forecast 12 months ahead
global_forecastPeriods: [12]

// User wants multiple forecast horizons
global_forecastPeriods: [3, 6, 12, 24]

// User wants quarterly forecasts
global_forecastPeriods: [4, 8, 12]
```

## **🏗️ Architecture**

### **Dataset Metadata Structure:**
```json
{
  "id": 24,
  "name": "Sales Data 2024",
  "metadata": {
    "summary": {
      "frequency": "monthly",
      "totalRows": 120,
      "dateRange": "2020-01 to 2024-12"
    }
  }
}
```

### **Global Settings Structure:**
```json
{
  "global_forecastPeriods": [12],
  "global_autoDetectFrequency": true,
  "global_csvSeparator": ",",
  "global_companyId": "default_company"
}
```

## **🔄 How They Work Together**

### **1. Model Selection:**
```javascript
// Seasonal models use dataset frequency
if (modelType === 'SARIMA') {
  const seasonalPeriods = getSeasonalPeriodsFromFrequency(dataset.frequency);
  // SARIMA uses seasonalPeriods for seasonal component
}

// All models use global forecast periods
const forecastPeriods = settings.global_forecastPeriods;
// Forecast 12 periods ahead regardless of dataset frequency
```

### **2. Job Creation:**
```javascript
// Get seasonal periods from dataset frequency
const seasonalPeriods = getSeasonalPeriodsFromFrequency(dataset.frequency);

// Get forecast periods from global settings
const forecastPeriods = settings.global_forecastPeriods;

// Create job with both
const job = {
  datasetId: 24,
  seasonalPeriods: 12,  // From dataset frequency
  forecastPeriods: [12] // From global settings
};
```

## **✅ Correct Implementation**

### **Dataset Frequency API:**
- `GET /api/dataset/:id/frequency` - Get dataset frequency
- `POST /api/dataset/:id/frequency` - Update dataset frequency
- `POST /api/dataset/:id/auto-detect-frequency` - Auto-detect frequency

### **Global Settings API:**
- `GET /api/settings` - Get global settings
- `POST /api/settings` - Update global settings
- `POST /api/settings/initialize` - Initialize default settings

## **❌ What We Fixed**

### **Before (Incorrect):**
```javascript
// ❌ Auto-updating global settings from dataset frequency
await updateGlobalSetting('global_frequency', dataset.frequency);
await updateGlobalSetting('global_seasonalPeriods', seasonalPeriods);
```

### **After (Correct):**
```javascript
// ✅ Keep dataset frequency dataset-specific
await updateDatasetMetadata(datasetId, { frequency: newFrequency });

// ✅ Keep global forecast periods as user preference
// No auto-update of global settings from dataset changes
```

## **🎯 Benefits of This Architecture**

1. **Flexibility**: Each dataset can have its own frequency
2. **User Control**: Global forecast periods remain user preference
3. **Accuracy**: Seasonal models use correct seasonal periods
4. **Consistency**: All forecasts use same forecast horizon
5. **Scalability**: Works with mixed-frequency datasets

## **📝 Usage Examples**

### **Setting Dataset Frequency:**
```javascript
// Set monthly frequency for dataset 24
await fetch('/api/dataset/24/frequency', {
  method: 'POST',
  body: JSON.stringify({ frequency: 'monthly' })
});
// Result: seasonalPeriods = 12
```

### **Setting Global Forecast Periods:**
```javascript
// Set global forecast periods to 12 months
await fetch('/api/settings', {
  method: 'POST',
  body: JSON.stringify({ 
    forecastPeriods: [12],
    autoDetectFrequency: true 
  })
});
```

### **Creating Forecast:**
```javascript
// Monthly dataset with 12-month forecast
const forecast = {
  datasetId: 24,
  frequency: 'monthly',        // From dataset
  seasonalPeriods: 12,         // Calculated from frequency
  forecastPeriods: [12],       // From global settings
  forecastHorizon: '12 months' // User-friendly description
};
```

This architecture ensures that frequency and forecast periods serve their distinct purposes without interfering with each other. 