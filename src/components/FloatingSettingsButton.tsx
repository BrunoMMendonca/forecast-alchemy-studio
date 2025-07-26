import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, LogOut, User } from 'lucide-react';
import { ForecastSettings } from '@/components/ForecastSettings';
import { OptimizationResultsExporter } from '@/components/OptimizationResultsExporter';
import { BusinessContext } from '@/types/businessContext';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { ZustandStoreDebugger } from './ModelUIDebugPanel';
import { useNavigate } from 'react-router-dom';

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
    datasetId?: number;
    filename?: string;
    name?: string;
  } | null;
  selectedSKU?: string | null;
  skuCount?: number;
  datasetCount?: number;
}

export const FloatingSettingsButton: React.FC<FloatingSettingsButtonProps> = (props) => {
  const globalSettings = useGlobalSettings();
  const [debugEnabled, setDebugEnabled] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const navigate = useNavigate();

  // Load user info on mount
  React.useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const sessionToken = localStorage.getItem('sessionToken');
        if (sessionToken) {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });
          if (response.ok) {
            const result = await response.json();
            setUser(result.user);
          }
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    };
    loadUserInfo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('refreshToken');
    window.location.reload();
  };

  const handleSetupWizard = () => {
    console.log('🔍 [SetupWizard Button] Button clicked');
    console.log('🔍 [SetupWizard Button] User:', user);
    console.log('🔍 [SetupWizard Button] User roles:', user?.roles);
    console.log('🔍 [SetupWizard Button] Is admin:', user?.roles && user.roles.length > 0 && user.roles.some((role: any) => 
      role.role_type === 'company_admin' || role.role_type === 'division_admin'
    ));
    console.log('🔍 [SetupWizard Button] Company ID:', user?.company_id);
    
    props.setSettingsOpen(false);
    console.log('🔍 [SetupWizard Button] Navigating to /setup');
    navigate('/setup');
  };
  return (
    <div>
      <Dialog open={props.settingsOpen} onOpenChange={props.setSettingsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex items-center justify-center w-12 h-12 rounded-full border-2 bg-white border-blue-700 text-blue-700 hover:bg-blue-50 hover:border-blue-800 hover:text-blue-800 transition-all duration-300 hover:scale-105 shadow-lg" 
            style={{ padding: 0 }}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Global Forecast Settings</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="settings">
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="export">Export Results</TabsTrigger>
              <TabsTrigger value="debug">Zustand Debugger</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
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
              <OptimizationResultsExporter 
                currentDataset={props.currentDataset} 
                selectedSKU={props.selectedSKU} 
                skuCount={props.skuCount} 
                datasetCount={props.datasetCount}
              />
            </TabsContent>
            <TabsContent value="debug" className="mt-4">
              <div className="space-y-4">
                <label htmlFor="debug-toggle" className="text-lg font-semibold">Zustand Debugger</label>
                <div className="flex items-center gap-2 mb-2">
                  <input id="debug-toggle" type="checkbox" checked={debugEnabled} onChange={e => setDebugEnabled(e.target.checked)} />
                  <span className="text-sm text-slate-600">{debugEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                {debugEnabled && <ZustandStoreDebugger />}
              </div>
            </TabsContent>
            <TabsContent value="account" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <User className="h-8 w-8 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">{user?.email}</p>
                    <p className="text-xs text-gray-500">Username: {user?.username}</p>
                    {user?.roles && user.roles.length > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        Roles: {user.roles.map((role: any) => role.role_type.replace('_', ' ').toUpperCase()).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                {/* Admin-only options */}
                {user?.roles && user.roles.length > 0 && user.roles.some((role: any) => 
                  role.role_type === 'company_admin' || role.role_type === 'division_admin'
                ) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Administrative Options</h4>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        onClick={handleSetupWizard}
                        className="w-full"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Return to Setup Wizard
                      </Button>
                      <p className="text-xs text-gray-500">
                        Modify your organization structure, divisions, clusters, and S&OP cycles
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Debug info - remove this after testing */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Debug Info</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>User loaded: {user ? 'Yes' : 'No'}</p>
                    <p>User roles: {user?.roles ? JSON.stringify(user.roles) : 'None'}</p>
                    <p>Is admin: {user?.roles && user.roles.length > 0 && user.roles.some((role: any) => 
                      role.role_type === 'company_admin' || role.role_type === 'division_admin'
                    ) ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Button 
                    variant="destructive" 
                    onClick={handleLogout}
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};