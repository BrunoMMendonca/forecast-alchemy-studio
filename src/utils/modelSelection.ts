// Utility to extract the current selection for a model (for right panel display)
export function getCurrentModelSelection(model) {
  const method = model.optimizationMethod || 'grid';
  let parameters = {};
  let compositeScore = null;
  let predictions = [];
  let avgValue = null;

  if (method === 'grid') {
    parameters = model.gridParameters || {};
    compositeScore = model.gridCompositeScore ?? null;
    predictions = model.gridPredictions || [];
    avgValue = model.gridAvgValue ?? null;
  } else if (method === 'ai') {
    parameters = model.aiParameters || {};
    compositeScore = model.aiCompositeScore ?? null;
    predictions = model.aiPredictions || [];
    avgValue = model.aiAvgValue ?? null;
  } else if (method === 'manual') {
    parameters = model.parameters || {};
    compositeScore = model.manualCompositeScore ?? null;
    predictions = model.manualPredictions || [];
    avgValue = model.manualAvgValue ?? null;
  }

  return {
    modelId: model.id,
    displayName: model.displayName,
    method,
    parameters,
    compositeScore,
    predictions,
    avgValue,
    isWinner: !!model.isWinner,
    sku: model.sku,
  };
} 
 
 
 