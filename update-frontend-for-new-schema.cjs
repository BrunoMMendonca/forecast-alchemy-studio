// =====================================================
// FRONTEND SCHEMA UPDATE SCRIPT
// Updates all frontend components to work with new database schema
// =====================================================

const fs = require('fs');
const path = require('path');

// =====================================================
// 1. REMOVE ACCURACY FIELD REFERENCES
// =====================================================

const componentsToUpdate = [
  'src/components/ReasoningDisplay.tsx',
  'src/components/ParameterStatusDisplay.tsx',
  'src/components/OptimizationResultsExporter.tsx',
  'src/components/OptimizationLogger.tsx',
  'src/components/ModelComparisonReasoning.tsx',
  'src/components/ForecastSummaryStats.tsx',
  'src/components/ForecastSettings.tsx',
  'src/components/ForecastFinalization.tsx',
  'src/components/ForecastControls.tsx'
];

componentsToUpdate.forEach(componentPath => {
  if (fs.existsSync(componentPath)) {
    let content = fs.readFileSync(componentPath, 'utf8');
    
    // Remove accuracy from interfaces/types
    content = content.replace(/expectedAccuracy\?: number;/g, '');
    content = content.replace(/accuracy: number;/g, '');
    content = content.replace(/accuracyWeight: number;/g, '');
    
    // Remove accuracy from props destructuring
    content = content.replace(/expectedAccuracy,?\s*/g, '');
    content = content.replace(/accuracy,?\s*/g, '');
    content = content.replace(/accuracyWeight,?\s*/g, '');
    
    // Remove accuracy from function parameters
    content = content.replace(/accuracy: number,?\s*/g, '');
    content = content.replace(/accuracyWeight: number,?\s*/g, '');
    
    // Remove accuracy from object destructuring
    content = content.replace(/accuracy: accuracy,?\s*/g, '');
    content = content.replace(/accuracyWeight: accuracyWeight,?\s*/g, '');
    
    // Remove accuracy from default weights
    content = content.replace(/accuracy: 10/g, '');
    content = content.replace(/accuracy: 0\.1/g, '');
    
    // Remove accuracy from weight calculations
    content = content.replace(/\+ editAccuracy/g, '');
    content = content.replace(/\+ accuracyWeight/g, '');
    content = content.replace(/editAccuracy !== accuracyWeight/g, 'false');
    content = content.replace(/editAccuracy === DEFAULT_WEIGHTS\.accuracy/g, 'false');
    
    // Remove accuracy from state
    content = content.replace(/const \[editAccuracy, setEditAccuracy\] = useState\(accuracyWeight\);/g, '');
    content = content.replace(/setEditAccuracy\(accuracyWeight\);/g, '');
    content = content.replace(/setEditAccuracy\(DEFAULT_WEIGHTS\.accuracy\);/g, '');
    
    // Remove accuracy from weight setters
    content = content.replace(/accuracy: editAccuracy/g, '');
    content = content.replace(/accuracy: accuracyWeight/g, '');
    
    // Remove accuracy from UI elements
    content = content.replace(/<Label htmlFor="accuracy-weight">Accuracy Weight<\/Label>/g, '');
    content = content.replace(/<Input[\s\S]*?id="accuracy-weight"[\s\S]*?\/>/g, '');
    content = content.replace(/<Slider[\s\S]*?accuracy-weight[\s\S]*?\/>/g, '');
    
    // Remove accuracy from data arrays
    content = content.replace(/,\s*{ label: 'Accuracy', value: editAccuracy, color: colors\[3\] }/g, '');
    content = content.replace(/,\s*{ label: 'Accuracy', value: accuracyWeight, color: colors\[3\] }/g, '');
    
    // Remove accuracy from filter conditions
    content = content.replace(/r\.accuracy && r\.accuracy > 80/g, 'true');
    content = content.replace(/result\.accuracy && result\.accuracy > 80/g, 'true');
    content = content.replace(/modelResult\.accuracy > 80/g, 'true');
    content = content.replace(/summary\.accuracy > 80/g, 'true');
    
    // Remove accuracy from display
    content = content.replace(/Expected: \{expectedAccuracy\.toFixed\(1\)\}% accuracy/g, '');
    content = content.replace(/\{expectedAccuracy\.toFixed\(1\)\}% expected accuracy/g, '');
    content = content.replace(/Expected Accuracy: <span[\s\S]*?>\{optimizationData\.expectedAccuracy\.toFixed\(1\)\}%<\/span>/g, '');
    content = content.replace(/<strong>Accuracy:<\/strong> \{step\.accuracy\.toFixed\(1\)\}%/g, '');
    content = content.replace(/Accuracy: \{decisionFactors\.accuracyWeight\.toFixed\(1\)\}%/g, '');
    content = content.replace(/<span[\s\S]*?>\{comparison\.accuracy\.toFixed\(1\)\}%<\/span>/g, '');
    content = content.replace(/High Accuracy \(&gt;80%\)/g, 'High Performance');
    content = content.replace(/\{bestModel\.accuracy\.toFixed\(1\)\}% Accuracy/g, 'Best Model');
    content = content.replace(/Accuracy:<\/span>/g, 'Performance:</span>');
    content = content.replace(/\{result\.accuracy\?\.toFixed\(1\) \|\| 'N\/A'\}%/g, 'N/A');
    content = content.replace(/\{modelResult\.accuracy\.toFixed\(1\)\}%/g, 'N/A');
    content = content.replace(/\{summary\.accuracy\.toFixed\(1\)\}%/g, 'N/A');
    
    // Remove accuracy from table headers
    content = content.replace(/<th[\s\S]*?>Accuracy<\/th>/g, '');
    content = content.replace(/Accuracy %/g, 'Performance');
    
    // Remove accuracy from CSV headers
    content = content.replace(/, 'Accuracy %'/g, '');
    content = content.replace(/, 'Accuracy'/g, '');
    
    // Remove accuracy from CSV data
    content = content.replace(/result\.accuracy\?\.toFixed\(1\) \|\| 'N\/A'/g, "'N/A'");
    
    // Remove accuracy from export descriptions
    content = content.replace(/including parameters, accuracy metrics, and performance data/g, 'including parameters and performance data');
    content = content.replace(/• Accuracy metrics \(Accuracy %, MAPE, RMSE, MAE\)/g, '• Performance metrics (MAPE, RMSE, MAE)');
    
    // Remove accuracy from weight arrays
    content = content.replace(/mapeWeight, rmseWeight, maeWeight, accuracyWeight/g, 'mapeWeight, rmseWeight, maeWeight');
    content = content.replace(/mape: mapeWeight, rmse: rmseWeight, mae: maeWeight, accuracy: accuracyWeight/g, 'mape: mapeWeight, rmse: rmseWeight, mae: maeWeight');
    
    // Remove accuracy from default weights
    content = content.replace(/const DEFAULT_WEIGHTS = \{ mape: 40, rmse: 30, mae: 20, accuracy: 10 \};/g, 'const DEFAULT_WEIGHTS = { mape: 50, rmse: 30, mae: 20 };');
    
    // Remove accuracy from weight calculations
    content = content.replace(/const total = editMape \+ editRmse \+ editMae \+ editAccuracy;/g, 'const total = editMape + editRmse + editMae;');
    content = content.replace(/const total = mapeWeight \+ rmseWeight \+ maeWeight \+ accuracyWeight;/g, 'const total = mapeWeight + rmseWeight + maeWeight;');
    
    // Remove accuracy from best model selection
    content = content.replace(/\(current\.accuracy \|\| 0\) > \(best\.accuracy \|\| 0\) \? current : best/g, 'current');
    
    // Remove accuracy from export options
    content = content.replace(/includeAccuracy: true,/g, '');
    
    // Remove accuracy from performance descriptions
    content = content.replace(/improve forecast accuracy/g, 'improve forecast performance');
    content = content.replace(/best forecast accuracy/g, 'best forecast performance');
    
    fs.writeFileSync(componentPath, content);
    console.log(`✅ Updated ${componentPath}`);
  }
});

// =====================================================
// 2. UPDATE SETTINGS REFERENCES
// =====================================================

// Update useGlobalSettings.ts to work with user_settings
const globalSettingsPath = 'src/hooks/useGlobalSettings.ts';
if (fs.existsSync(globalSettingsPath)) {
  let content = fs.readFileSync(globalSettingsPath, 'utf8');
  
  // Remove accuracyWeight from interface
  content = content.replace(/accuracyWeight: number;/g, '');
  
  // Remove accuracyWeight from default settings
  content = content.replace(/accuracyWeight: 10,/g, '');
  
  // Remove accuracyWeight from state
  content = content.replace(/const \[accuracyWeight, setAccuracyWeightState\] = useState<number>\(DEFAULT_SETTINGS\.accuracyWeight\);/g, '');
  
  // Remove accuracyWeight from settings sync
  content = content.replace(/setAccuracyWeightState\(settings\.accuracyWeight\);/g, '');
  content = content.replace(/accuracyWeight: settings\.accuracyWeight \|\| DEFAULT_SETTINGS\.accuracyWeight,/g, '');
  
  // Remove accuracyWeight from localStorage sync
  content = content.replace(/accuracyWeight: settings\.accuracyWeight \|\| DEFAULT_SETTINGS\.accuracyWeight,/g, '');
  
  // Remove accuracyWeight from change detection
  content = content.replace(/mapeWeight, rmseWeight, maeWeight, accuracyWeight/g, 'mapeWeight, rmseWeight, maeWeight');
  
  // Remove accuracyWeight from return object
  content = content.replace(/accuracyWeight,/g, '');
  content = content.replace(/setAccuracyWeight: setAccuracyWeightState,/g, '');
  
  fs.writeFileSync(globalSettingsPath, content);
  console.log('✅ Updated useGlobalSettings.ts');
}

// =====================================================
// 3. UPDATE OPTIMIZATION STATUS HOOK
// =====================================================

// Update useOptimizationStatus.ts to handle new data structure
const optimizationStatusPath = 'src/hooks/useOptimizationStatus.ts';
if (fs.existsSync(optimizationStatusPath)) {
  let content = fs.readFileSync(optimizationStatusPath, 'utf8');
  
  // Update interface to include sku_description
  content = content.replace(/interface OptimizationJob \{/g, `interface OptimizationJob {
  sku_description?: string;`);
  
  // Update the data processing to use sku_description
  content = content.replace(/sku: job\.sku,/g, `sku: job.sku,
        skuDescription: job.sku_description || job.sku,`);
  
  fs.writeFileSync(optimizationStatusPath, content);
  console.log('✅ Updated useOptimizationStatus.ts');
}

// =====================================================
// 4. UPDATE OPTIMIZATION QUEUE COMPONENT
// =====================================================

// Update OptimizationQueue.tsx to display SKU descriptions
const optimizationQueuePath = 'src/components/OptimizationQueue.tsx';
if (fs.existsSync(optimizationQueuePath)) {
  let content = fs.readFileSync(optimizationQueuePath, 'utf8');
  
  // Update to use skuDescription if available
  content = content.replace(/job\.sku/g, 'job.skuDescription || job.sku');
  
  fs.writeFileSync(optimizationQueuePath, content);
  console.log('✅ Updated OptimizationQueue.tsx');
}

// =====================================================
// 5. UPDATE FLOATING SETTINGS BUTTON
// =====================================================

// Update FloatingSettingsButton.tsx to remove accuracy
const floatingSettingsPath = 'src/components/FloatingSettingsButton.tsx';
if (fs.existsSync(floatingSettingsPath)) {
  let content = fs.readFileSync(floatingSettingsPath, 'utf8');
  
  // Remove accuracyWeight from props
  content = content.replace(/accuracyWeight: number;/g, '');
  content = content.replace(/accuracyWeight=\{props\.accuracyWeight\}/g, '');
  
  fs.writeFileSync(floatingSettingsPath, content);
  console.log('✅ Updated FloatingSettingsButton.tsx');
}

// =====================================================
// 6. UPDATE MAIN LAYOUT
// =====================================================

// Update MainLayout.tsx to remove accuracy from change detection
const mainLayoutPath = 'src/components/MainLayout.tsx';
if (fs.existsSync(mainLayoutPath)) {
  let content = fs.readFileSync(mainLayoutPath, 'utf8');
  
  // Remove accuracyWeight from change detection
  content = content.replace(/mapeWeight, rmseWeight, maeWeight, accuracyWeight/g, 'mapeWeight, rmseWeight, maeWeight');
  
  fs.writeFileSync(mainLayoutPath, content);
  console.log('✅ Updated MainLayout.tsx');
}

// =====================================================
// 7. UPDATE TYPES
// =====================================================

// Update types to remove accuracy
const typesToUpdate = [
  'src/types/optimization.ts',
  'src/types/forecast.ts',
  'src/types/globalSettings.ts'
];

typesToUpdate.forEach(typePath => {
  if (fs.existsSync(typePath)) {
    let content = fs.readFileSync(typePath, 'utf8');
    
    // Remove accuracy from interfaces
    content = content.replace(/accuracy\?: number;/g, '');
    content = content.replace(/accuracy: number;/g, '');
    content = content.replace(/accuracyWeight: number;/g, '');
    
    // Remove accuracy from default values
    content = content.replace(/accuracy: 10,/g, '');
    content = content.replace(/accuracy: 0\.1,/g, '');
    
    fs.writeFileSync(typePath, content);
    console.log(`✅ Updated ${typePath}`);
  }
});

console.log('\n🎉 All frontend components updated!');
console.log('\n📋 Summary of frontend changes:');
console.log('✅ Removed all accuracy field references from components');
console.log('✅ Updated settings to work with user_settings table');
console.log('✅ Updated optimization queue to show SKU descriptions');
console.log('✅ Removed accuracy from types and interfaces');
console.log('✅ Updated weight calculations to exclude accuracy');
console.log('✅ Updated UI text to use "Performance" instead of "Accuracy"');
console.log('\n🚀 Your frontend should now be fully compatible with the new schema!'); 