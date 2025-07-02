import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import { ForecastSettings } from '@/components/ForecastSettings';
import { OptimizationResultsExporter } from '@/components/OptimizationResultsExporter';
import { BusinessContext } from '@/types/businessContext';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';

interface FloatingSettingsButtonProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
  aiForecastModelOptimizationEnabled: boolean;
  setaiForecastModelOptimizationEnabled: (enabled: boolean) => void;
  aiCsvImportEnabled: boolean;
  setAiCsvImportEnabled: (enabled: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  aiFailureThreshold: number;
  setAiFailureThreshold: (threshold: number) => void;
  largeFileProcessingEnabled: boolean;
  setLargeFileProcessingEnabled: (enabled: boolean) => void;
  largeFileThreshold: number;
  setLargeFileThreshold: (threshold: number) => void;
  aiReasoningEnabled: boolean;
  setAiReasoningEnabled: (enabled: boolean) => void;
  mapeWeight: number;
  rmseWeight: number;
  maeWeight: number;
  accuracyWeight: number;
  currentDataset?: {
    filePath?: string;
    filename?: string;
    name?: string;
  } | null;
  selectedSKU?: string | null;
  skuCount?: number;
  datasetCount?: number;
}

export const FloatingSettingsButton: React.FC<FloatingSettingsButtonProps> = (props) => {
  const globalSettings = useGlobalSettings();
  return (
    <div className="fixed top-6 right-6 z-50">
      <Dialog open={props.settingsOpen} onOpenChange={props.setSettingsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full shadow-lg" style={{ width: 46, height: 46, minWidth: 46, minHeight: 46, padding: 0 }}>
            <Settings className="h-6 w-6 mx-auto my-auto" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Global Forecast Settings</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="settings">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="export">Export Results</TabsTrigger>
            </TabsList>
            <TabsContent value="settings" className="mt-4">
              <ForecastSettings
                forecastPeriods={props.forecastPeriods}
                setForecastPeriods={props.setForecastPeriods}
                businessContext={props.businessContext}
                setBusinessContext={props.setBusinessContext}
                aiForecastModelOptimizationEnabled={props.aiForecastModelOptimizationEnabled}
                setaiForecastModelOptimizationEnabled={props.setaiForecastModelOptimizationEnabled}
                aiCsvImportEnabled={props.aiCsvImportEnabled}
                setAiCsvImportEnabled={props.setAiCsvImportEnabled}
                aiFailureThreshold={props.aiFailureThreshold}
                setAiFailureThreshold={props.setAiFailureThreshold}
                largeFileProcessingEnabled={props.largeFileProcessingEnabled}
                setLargeFileProcessingEnabled={props.setLargeFileProcessingEnabled}
                largeFileThreshold={props.largeFileThreshold}
                setLargeFileThreshold={props.setLargeFileThreshold}
                aiReasoningEnabled={props.aiReasoningEnabled}
                setAiReasoningEnabled={props.setAiReasoningEnabled}
                mapeWeight={props.mapeWeight}
                rmseWeight={props.rmseWeight}
                maeWeight={props.maeWeight}
                accuracyWeight={props.accuracyWeight}
                setWeights={globalSettings.setWeights}
              />
            </TabsContent>
            <TabsContent value="export" className="mt-4">
              <OptimizationResultsExporter currentDataset={props.currentDataset} selectedSKU={props.selectedSKU} skuCount={props.skuCount} datasetCount={props.datasetCount} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};