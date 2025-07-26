import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, Database, Package, Star } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';

interface OptimizationResultsExporterProps {
  className?: string;
  currentDataset?: {
    datasetId?: number;
    filename?: string;
    name?: string;
  } | null;
  selectedSKU?: string | null;
  skuCount?: number;
  datasetCount?: number;
  selectedSKUDescription?: string;
}

export const OptimizationResultsExporter: React.FC<OptimizationResultsExporterProps> = ({ 
  className, 
  currentDataset,
  selectedSKU,
  skuCount = 1,
  datasetCount = 1,
  selectedSKUDescription,
}) => {
  const [isExporting, setIsExporting] = React.useState<string | null>(null);
  const [bestOnly, setBestOnly] = React.useState(false);
  // Single export mode state
  const [exportMode, setExportMode] = useState<'dataset' | 'sku' | 'global'>('dataset');
  const { toast } = useToast();
  const globalSettings = useGlobalSettings();
  const { skuGroups, activeOptimizations, completedOptimizations, failedOptimizations } = useOptimizationStatusContext();

  // Create a flat array of all optimizations for compatibility
  const optimizations = useMemo(() => {
    const allOptimizations: any[] = [];
    
    // Add active optimizations
    activeOptimizations.forEach(batch => {
      Object.values(batch.optimizations).forEach(opt => {
        allOptimizations.push({
          ...opt,
          datasetId: batch.datasetId,
          sku: batch.sku,
          isOptimizing: batch.isOptimizing
        });
      });
    });
    
    // Add completed optimizations
    completedOptimizations.forEach(batch => {
      Object.values(batch.optimizations).forEach(opt => {
        allOptimizations.push({
          ...opt,
          datasetId: batch.datasetId,
          sku: batch.sku,
          isOptimizing: false
        });
      });
    });
    
    // Add failed optimizations
    failedOptimizations.forEach(batch => {
      Object.values(batch.optimizations).forEach(opt => {
        allOptimizations.push({
          ...opt,
          datasetId: batch.datasetId,
          sku: batch.sku,
          isOptimizing: false
        });
      });
    });
    
    return allOptimizations;
  }, [activeOptimizations, completedOptimizations, failedOptimizations]);

  // Derived logic for toggles based on the table
  // Dataset Specific
  const onlyOneDataset = datasetCount === 1;
  const onlyOneSKU = skuCount === 1;
  const multipleDatasets = datasetCount > 1;
  const multipleSKUs = skuCount > 1;

  // Derived booleans from exportMode
  const isDatasetSpecific = exportMode === 'dataset';
  const isSkuSpecific = exportMode === 'sku';

  // Toggle handlers
  const handleDatasetSpecificChange = (checked: boolean) => {
    if (checked) setExportMode('dataset');
    else setExportMode('global');
  };
  const handleSkuSpecificChange = (checked: boolean) => {
    if (checked) setExportMode('sku');
    else setExportMode('global');
  };

  // Disable logic for toggles
  const isDatasetSpecificDisabled = onlyOneDataset;
  const isSkuSpecificDisabled = onlyOneSKU;

  // [EXPORTER STATE] log
  console.log('[EXPORTER STATE]', {
    exportMode,
    isDatasetSpecific,
    isSkuSpecific,
    optimizations,
    selectedSKU
  });

  // Improved SKU-specific export disabling logic
  let isSkuExportDisabled = false;
  if (isSkuSpecific && selectedSKU) {
    const optimizationForSKU = optimizations.find(opt => opt.sku === selectedSKU);
    if (optimizationForSKU) {
      isSkuExportDisabled = optimizationForSKU.isOptimizing;
    } else {
      isSkuExportDisabled = false;
    }
  }
  
  // Dataset-specific export disabling logic
  const isDatasetExportDisabled = isDatasetSpecific && optimizations.some(opt => {
    const datasetIdMatch = !currentDataset?.datasetId || opt.datasetId === currentDataset.datasetId;
    return datasetIdMatch && opt.isOptimizing;
  });
  
  // Global export disabling logic
  const isGlobalExportDisabled = exportMode === 'global' && optimizations.some(opt => opt.isOptimizing);

  const exportResults = async (method: 'grid' | 'ai' | 'all') => {
    setIsExporting(method);
    
    try {
      // Convert weights from percentages to decimals for backend
      const mapeWeight = (globalSettings.mapeWeight ?? 40) / 100;
      const rmseWeight = (globalSettings.rmseWeight ?? 30) / 100;
      const maeWeight = (globalSettings.maeWeight ?? 20) / 100;
      const accuracyWeight = (globalSettings.accuracyWeight ?? 10) / 100;
      
      // Build query parameters
      const params = new URLSearchParams({
        method,
        mapeWeight: mapeWeight.toString(),
        rmseWeight: rmseWeight.toString(),
        maeWeight: maeWeight.toString(),
        accuracyWeight: accuracyWeight.toString(),
      });

      // Add bestOnly filter if enabled
      if (bestOnly) {
        params.append('bestOnly', 'true');
      }

      // Add dataset filter if enabled and dataset is available
      if (isDatasetSpecific && currentDataset?.datasetId) {
        params.append('datasetId', currentDataset.datasetId.toString());
      }

      // Add SKU filter if enabled and SKU is available
      if (isSkuSpecific && selectedSKU) {
        params.append('sku', selectedSKU);
      }

      const response = await fetch(`/api/jobs/export-results?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export results');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `optimization-results-${method}-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const datasetInfo = isDatasetSpecific && currentDataset?.name ? ` for ${currentDataset.name}` : '';
      toast({
        title: "Export Successful",
        description: `${method.toUpperCase()} optimization results exported successfully${datasetInfo} with current metric weights.`,
        action: <CheckCircle className="h-4 w-4 text-green-600" />,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'Failed to export optimization results',
        variant: "destructive",
        action: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setIsExporting(null);
    }
  };

  const getMethodDisplayName = (method: string) => {
    switch (method) {
      case 'grid': return 'Grid Search';
      case 'ai': return 'AI Optimization';
      case 'all': return 'All Methods';
      default: return method;
    }
  };

  const getMethodDescription = (method: string) => {
    switch (method) {
      case 'grid': return 'Export results from grid search optimization only';
      case 'ai': return 'Export results from AI-powered optimization only';
      case 'all': return 'Export results from all optimization methods';
      default: return '';
    }
  };

  const methods: Array<'grid' | 'ai' | 'all'> = ['grid', 'ai', 'all'];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Optimization Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Download detailed CSV reports of optimization results including parameters, metrics, and performance data.
          </p>
          
          {/* Best Only toggle */}
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Star className="h-4 w-4 text-yellow-600" />
            <Switch
              id="best-only"
              checked={bestOnly}
              onCheckedChange={setBestOnly}
              disabled={isExporting !== null}
            />
            <Label htmlFor="best-only" className="text-sm font-medium">
              Export only best results (winner params)
            </Label>
            <span className="text-xs text-yellow-700 ml-2">Only include the best result for each SKU/model/method.</span>
          </div>
          
          {/* Dataset-specific toggle */}
          {currentDataset && (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Database className="h-4 w-4 text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="dataset-specific"
                    checked={onlyOneDataset ? true : isDatasetSpecific}
                    onCheckedChange={handleDatasetSpecificChange}
                    disabled={onlyOneDataset ? true : isDatasetSpecificDisabled || isExporting !== null}
                  />
                  <Label htmlFor="dataset-specific" className="text-sm font-medium">
                    Export dataset-specific results only
                  </Label>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  {onlyOneDataset
                    ? `Will export only results for: ${currentDataset.name || currentDataset.filename} (Only one dataset available)`
                    : isDatasetSpecific
                      ? `Will export only results for: ${currentDataset.name || currentDataset.filename}`
                      : 'Will export all optimization results from all datasets'
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* SKU-specific toggle */}
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Package className="h-4 w-4 text-green-600" />
                  <Switch
                    id="sku-specific"
              checked={isSkuSpecific}
              onCheckedChange={handleSkuSpecificChange}
              disabled={isSkuSpecificDisabled}
                  />
                  <Label htmlFor="sku-specific" className="text-sm font-medium">
                    Export SKU-specific results only
                  </Label>
            <span className="text-xs text-green-700 ml-2">
              {isSkuSpecific
                ? (selectedSKU
                    ? <>Will export results for SKU: <b>{selectedSKU}</b>{selectedSKUDescription ? ` (${selectedSKUDescription})` : ''}</>
                    : "Will export results for the selected SKU")
                : "Will export results for all SKUs in the dataset"}
            </span>
            </div>
          
          <div className="grid gap-3">
            {methods.map((method) => {
              const disabled =
                isExporting !== null ||
                isSkuExportDisabled ||
                isDatasetExportDisabled ||
                isGlobalExportDisabled;
              return (
              <div key={method} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{getMethodDisplayName(method)}</h4>
                    {method === 'ai' && (
                      <Badge variant="secondary" className="text-xs">AI-Powered</Badge>
                    )}
                    {method === 'grid' && (
                      <Badge variant="outline" className="text-xs">Systematic</Badge>
                    )}
                    {method === 'all' && (
                      <Badge variant="default" className="text-xs">Complete</Badge>
                    )}
                      {isDatasetSpecific && (
                      <Badge variant="secondary" className="text-xs">Dataset-Specific</Badge>
                    )}
                    {isSkuSpecific && (
                      <Badge variant="secondary" className="text-xs">SKU-Specific</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{getMethodDescription(method)}</p>
                </div>
                <Button
                  onClick={() => exportResults(method)}
                    disabled={disabled}
                  variant="outline"
                  size="sm"
                  className="ml-4"
                    title={
                      isExporting !== null ? 'Export in progress' :
                      isSkuExportDisabled ? 'Cannot export: Optimization is still running or incomplete for the selected SKU.' :
                      isDatasetExportDisabled ? 'Cannot export: Optimization is still running or incomplete for this dataset.' :
                      isGlobalExportDisabled ? 'Cannot export: Optimization is still running or incomplete.' :
                      undefined
                    }
                >
                  {isExporting === method ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </>
                  )}
                </Button>
              </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-2">CSV Contents:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Job metadata (ID, SKU, model, method, timestamps)</li>
              <li>• Model parameters and configuration</li>
              <li>• Accuracy metrics (Accuracy, MAPE, RMSE, MAE)</li>
              <li>• Normalized metrics (0-1 scale, higher is better)</li>
              <li>• Composite score using current metric weights</li>
              <li>• Metric weights used for "best result" calculation</li>
              <li>• Training and validation data sizes</li>
              <li>• Success/failure status and error messages</li>
              <li>• Best result identification</li>
              {isDatasetSpecific && <li>• <strong>Filtered to current dataset only</strong></li>}
              {isSkuSpecific && <li>• <strong>Filtered to current SKU only</strong></li>}
              {bestOnly && <li>• <strong>Only best results (winner params)</strong></li>}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 