import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import { ForecastSettings } from '@/components/ForecastSettings';
import { CacheDebugger } from './CacheDebugger';
import { BusinessContext } from '@/types/businessContext';
import { useOptimizationCacheContext } from '@/context/OptimizationCacheContext';

interface FloatingSettingsButtonProps {
  forecastPeriods: number;
  setForecastPeriods: (periods: number) => void;
  businessContext: BusinessContext;
  setBusinessContext: (context: BusinessContext) => void;
  aiForecastModelOptimizationEnabled: boolean;
  setaiForecastModelOptimizationEnabled: (enabled: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  aiFailureThreshold: number;
  setAiFailureThreshold: (threshold: number) => void;
}

export const FloatingSettingsButton: React.FC<FloatingSettingsButtonProps> = ({
  forecastPeriods,
  setForecastPeriods,
  businessContext,
  setBusinessContext,
  aiForecastModelOptimizationEnabled,
  setaiForecastModelOptimizationEnabled,
  settingsOpen,
  setSettingsOpen,
  aiFailureThreshold,
  setAiFailureThreshold
}) => {
  return (
    <div className="fixed top-6 right-6 z-50">
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Settings className="h-6 w-6 text-white" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Global Forecast Settings</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="cache">Cache Debug</TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings" className="mt-4">
              <ForecastSettings
                forecastPeriods={forecastPeriods}
                setForecastPeriods={setForecastPeriods}
                businessContext={businessContext}
                setBusinessContext={setBusinessContext}
                aiForecastModelOptimizationEnabled={aiForecastModelOptimizationEnabled}
                setaiForecastModelOptimizationEnabled={setaiForecastModelOptimizationEnabled}
                aiFailureThreshold={aiFailureThreshold}
                setAiFailureThreshold={setAiFailureThreshold}
              />
            </TabsContent>
            
            <TabsContent value="cache" className="mt-4">
              <CacheDebugger cacheContext={useOptimizationCacheContext()} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};
