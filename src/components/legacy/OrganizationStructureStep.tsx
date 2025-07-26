import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Building2, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useSetupWizardStore } from '../../../store/setupWizardStore';

interface BusinessConfigurationStepProps {
  orgStructure: any;
  safeSetOrgStructure: (updates: any) => void;
  safeCalculateSetupFlow: () => void;
  safeInitializeMultipleCsvImport: (divisions: number, remainingDivisions?: string[]) => void;
  getAvailableImportLevels: () => any;
  handleImportLevelChange: (level: 'company' | 'division') => void;
}

export const BusinessConfigurationStep: React.FC<BusinessConfigurationStepProps> = ({
  orgStructure,
  safeSetOrgStructure,
  safeCalculateSetupFlow,
  safeInitializeMultipleCsvImport,
  getAvailableImportLevels,
  handleImportLevelChange
}) => {
  const { hasMultipleDivisions, hasMultipleClusters, enableLifecycleTracking } = orgStructure;
  const { saveOrgStructureConfig } = useSetupWizardStore();
  
  // Save configuration whenever it changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveOrgStructureConfig();
    }, 1000); // Debounce for 1 second
    
    return () => clearTimeout(timeoutId);
  }, [orgStructure.hasMultipleDivisions, orgStructure.hasMultipleClusters, orgStructure.importLevel, orgStructure.divisionCsvType, orgStructure.enableLifecycleTracking, saveOrgStructureConfig]);
  
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            Business Configuration
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your organizational structure, data import approach, and product lifecycle management
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Organizational Structure Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizational Structure
            </h3>
            
            {/* Multiple Divisions and Clusters Toggles - Full Width */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Multiple Divisions</Label>
                  <p className="text-xs text-gray-500">Does your company have multiple business divisions?</p>
                </div>
                <Switch
                  checked={orgStructure.hasMultipleDivisions}
                  onCheckedChange={(checked) => {
                    safeSetOrgStructure({ hasMultipleDivisions: checked });
                    // Recalculate setup flow when structure changes
                    setTimeout(() => safeCalculateSetupFlow(), 100);
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Multiple Clusters</Label>
                  <p className="text-xs text-gray-500">Does your company have multiple geographic/operational clusters?</p>
                </div>
                <Switch
                  checked={orgStructure.hasMultipleClusters}
                  onCheckedChange={(checked) => {
                    safeSetOrgStructure({ hasMultipleClusters: checked });
                    // Recalculate setup flow when structure changes
                    setTimeout(() => safeCalculateSetupFlow(), 100);
                  }}
                />
              </div>
            </div>
            
            {/* Data Import Level Section - Below the toggles */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Data Import Level</h4>
              <p className="text-sm text-gray-600">
                Each S&OP cycle, your company will import CSV sales data:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="import-company"
                    name="importLevel"
                    value="company"
                    checked={orgStructure.importLevel === 'company'}
                    onChange={() => handleImportLevelChange('company')}
                    className="text-blue-600"
                  />
                  <Label htmlFor="import-company" className="text-sm">
                    Company-wide (one CSV per cycle)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="import-division"
                    name="importLevel"
                    value="division"
                    checked={orgStructure.importLevel === 'division'}
                    onChange={() => handleImportLevelChange('division')}
                    disabled={!getAvailableImportLevels().division}
                    className="text-blue-600"
                  />
                  <Label htmlFor="import-division" className="text-sm">
                    Division-specific (one CSV per division per cycle)
                  </Label>
                </div>
              </div>
              
              {orgStructure.importLevel === 'division' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Division CSV Type</h5>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="csv-with-division"
                        name="divisionCsvType"
                        value="withDivisionColumn"
                        checked={orgStructure.divisionCsvType === 'withDivisionColumn'}
                        onChange={() => safeSetOrgStructure({ divisionCsvType: 'withDivisionColumn' })}
                        className="text-blue-600"
                      />
                      <Label htmlFor="csv-with-division" className="text-sm">
                        CSV includes division column
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="csv-without-division"
                        name="divisionCsvType"
                        value="withoutDivisionColumn"
                        checked={orgStructure.divisionCsvType === 'withoutDivisionColumn'}
                        onChange={() => safeSetOrgStructure({ divisionCsvType: 'withoutDivisionColumn' })}
                        className="text-blue-600"
                      />
                      <Label htmlFor="csv-without-division" className="text-sm">
                        Separate CSV per division
                      </Label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Lifecycle Management Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Product Lifecycle Management
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Enable Product Lifecycle Tracking</Label>
                  <p className="text-xs text-gray-500">Track products through launch, growth, and end-of-life phases</p>
                </div>
                <Switch
                  checked={orgStructure.enableLifecycleTracking || false}
                  onCheckedChange={(checked) => {
                    safeSetOrgStructure({ enableLifecycleTracking: checked });
                    // Recalculate setup flow when lifecycle tracking changes
                    setTimeout(() => safeCalculateSetupFlow(), 100);
                  }}
                />
              </div>
              
              {orgStructure.enableLifecycleTracking && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Lifecycle Phases</h4>
                  <p className="text-sm text-green-800 mb-3">
                    During CSV import, you'll be able to map your lifecycle data to these phases:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Launch Phase</Badge>
                      <span className="text-sm text-gray-600">New products entering the market</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Growth & Stability Phase</Badge>
                      <span className="text-sm text-gray-600">Established products with steady demand</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">End-of-Life Phase</Badge>
                      <span className="text-sm text-gray-600">Products being phased out</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 