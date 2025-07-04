import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Download, RefreshCw } from 'lucide-react';
import { useManualAIPreferences } from '@/hooks/useManualAIPreferences';

interface CacheDebuggerProps {
  cacheContext: ReturnType<typeof import('@/hooks/useOptimizationCache').useOptimizationCache>;
}

export const CacheDebugger: React.FC<CacheDebuggerProps> = ({ cacheContext }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('optimization');
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  
  // Load cache and preferences directly like preferences do
  const [optimizationCache, setOptimizationCache] = useState(() => {
    try {
      const stored = localStorage.getItem('forecast_optimization_cache');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem('manual_ai_preferences');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  const { 
    cacheStats, 
    cacheVersion,
    clearAllCache, 
    clearCacheForSKU 
  } = cacheContext;
  
  const { clearManualAIPreferences } = useManualAIPreferences();

  // Function to refresh cache and preferences from localStorage
  const refreshData = () => {
    try {
      const storedCache = localStorage.getItem('forecast_optimization_cache');
      const storedPrefs = localStorage.getItem('manual_ai_preferences');
      
      setOptimizationCache(storedCache ? JSON.parse(storedCache) : {});
      setPreferences(storedPrefs ? JSON.parse(storedPrefs) : {});
      setLastUpdate(new Date().toLocaleTimeString());
      
      console.log('🔄 CACHE DEBUGGER: Refreshed from localStorage', {
        cacheKeys: Object.keys(storedCache ? JSON.parse(storedCache) : {}),
        preferenceKeys: Object.keys(storedPrefs ? JSON.parse(storedPrefs) : {})
      });
    } catch (error) {
      console.error('Failed to refresh cache data:', error);
    }
  };

  // React to cache version changes immediately
  useEffect(() => {
    refreshData();
    console.log(`🔄 CACHE DEBUGGER: Version ${cacheVersion} - Real-time update triggered`);
  }, [cacheVersion]);

  // Auto-refresh every 1 second when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(refreshData, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = () => {
    refreshData();
    console.log('🔄 CACHE DEBUGGER: Manual refresh', { cacheVersion });
  };

  const handleExportCache = () => {
    const exportData = {
      optimizationCache,
      preferences,
      cacheStats,
      cacheVersion,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cache-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMethodBadgeColor = (method?: string) => {
    if (method?.startsWith('ai_')) return 'bg-blue-500';
    if (method === 'grid') return 'bg-green-500';
    if (method === 'manual') return 'bg-gray-500';
    return 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cache Debugger</h3>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm">Auto-refresh</label>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCache}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={() => {
              clearAllCache();
              clearManualAIPreferences();
              setTimeout(refreshData, 100);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Cache Statistics
            {autoRefresh && <Badge variant="outline" className="text-xs">Live v{cacheVersion}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Hits:</span> {cacheStats.hits}
            </div>
            <div>
              <span className="font-medium">Misses:</span> {cacheStats.misses}
            </div>
            <div>
              <span className="font-medium">Skipped:</span> {cacheStats.skipped}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Last updated: {lastUpdate} | Version: {cacheVersion} | Cache entries: {Object.keys(optimizationCache).length}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="optimization">Optimization Cache</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="optimization">
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {Object.keys(optimizationCache).length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">No optimization cache entries</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(optimizationCache).map(([sku, skuCache]) => (
                  <Card key={sku}>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center justify-between">
                        SKU: {sku}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            clearCacheForSKU(sku);
                            setTimeout(refreshData, 100);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(skuCache).map(([modelId, modelCache]) => (
                          <div key={modelId} className="border-l-2 border-gray-200 pl-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">Model: {modelId}</span>
                              {modelCache.selected && (
                                <Badge variant="outline" className="text-xs">
                                  Selected: {modelCache.selected}
                                </Badge>
                              )}
                            </div>
                            
                            {modelCache.ai && (
                              <div className="mb-2 p-2 bg-blue-50 rounded text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getMethodBadgeColor(modelCache.ai.method)}>
                                    AI: {modelCache.ai.method || 'unknown'}
                                  </Badge>
                                  <span className="text-gray-600">
                                    {formatTimestamp(modelCache.ai.timestamp)}
                                  </span>
                                </div>
                                <div>Hash: {modelCache.ai.dataHash}</div>
                                {modelCache.ai.confidence && (
                                  <div>Confidence: {modelCache.ai.confidence}%</div>
                                )}
                                <div>Parameters: {JSON.stringify(modelCache.ai.parameters)}</div>
                              </div>
                            )}
                            
                            {modelCache.grid && (
                              <div className="mb-2 p-2 bg-green-50 rounded text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getMethodBadgeColor(modelCache.grid.method)}>
                                    Grid: {modelCache.grid.method || 'unknown'}
                                  </Badge>
                                  <span className="text-gray-600">
                                    {formatTimestamp(modelCache.grid.timestamp)}
                                  </span>
                                </div>
                                <div>Hash: {modelCache.grid.dataHash}</div>
                                {modelCache.grid.confidence && (
                                  <div>Confidence: {modelCache.grid.confidence}%</div>
                                )}
                                <div>Parameters: {JSON.stringify(modelCache.grid.parameters)}</div>
                              </div>
                            )}

                            {modelCache.manual && (
                              <div className="mb-2 p-2 bg-gray-50 rounded text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getMethodBadgeColor(modelCache.manual.method)}>
                                    Manual: {modelCache.manual.method || 'manual'}
                                  </Badge>
                                  <span className="text-gray-600">
                                    {formatTimestamp(modelCache.manual.timestamp)}
                                  </span>
                                </div>
                                <div>Hash: {modelCache.manual.dataHash}</div>
                                <div>Parameters: {JSON.stringify(modelCache.manual.parameters)}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="preferences">
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {Object.keys(preferences).length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">No preference entries</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(preferences).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span className="font-mono">{key}</span>
                    <Badge variant={String(value) === 'manual' ? 'secondary' : String(value) === 'ai' ? 'default' : 'outline'}>
                      {String(value)}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
