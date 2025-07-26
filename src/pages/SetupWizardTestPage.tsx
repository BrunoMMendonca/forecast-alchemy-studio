import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SetupWizardRefactored } from '../components/SetupWizard/SetupWizardRefactored';
import { useSetupWizardStoreRefactored } from '../store/setupWizardStoreRefactored';
import { setupWizardConfigManager } from '../config/SetupWizardConfig';
import { importStrategyManager } from '../strategies/ImportStrategy';
import { commandManager } from '../commands/SetupWizardCommands';

export const SetupWizardTestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('wizard');
  const [showWizard, setShowWizard] = useState(false);

  const {
    currentState,
    businessConfig,
    csvImportData,
    pendingDivisions,
    pendingClusters,
    lifecycleMappings,
    multipleCsvImport,
    validationErrors,
    canUndo,
    canRedo,
    undoStackSize,
    redoStackSize
  } = useSetupWizardStoreRefactored();

  const handleWizardComplete = () => {
    setShowWizard(false);
    console.log('Setup Wizard completed!');
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    console.log('Setup Wizard cancelled!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Setup Wizard Refactored Architecture</h1>
          <p className="text-xl text-gray-600 mt-2">
            Professional architecture demonstration with Configuration Manager, State Machine, Strategy Pattern, and Command Pattern
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-center space-x-4">
          <Button
            variant={activeTab === 'wizard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('wizard')}
          >
            Setup Wizard
          </Button>
          <Button
            variant={activeTab === 'architecture' ? 'default' : 'outline'}
            onClick={() => setActiveTab('architecture')}
          >
            Architecture Overview
          </Button>
          <Button
            variant={activeTab === 'state' ? 'default' : 'outline'}
            onClick={() => setActiveTab('state')}
          >
            State Management
          </Button>
          <Button
            variant={activeTab === 'commands' ? 'default' : 'outline'}
            onClick={() => setActiveTab('commands')}
          >
            Command History
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="wizard" className="space-y-6">
            {/* Setup Wizard */}
            <Card>
              <CardHeader>
                <CardTitle>Setup Wizard</CardTitle>
              </CardHeader>
              <CardContent>
                {showWizard ? (
                  <SetupWizardRefactored
                    onComplete={handleWizardComplete}
                    onCancel={handleWizardCancel}
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-gray-600">
                      Click the button below to start the refactored Setup Wizard
                    </p>
                    <Button onClick={() => setShowWizard(true)}>
                      Start Setup Wizard
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-6">
            {/* Configuration Manager */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration Manager</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Import Levels</h3>
                    <div className="space-y-2">
                      {setupWizardConfigManager.getConfig().importLevels.map((level) => (
                        <div key={level.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{level.label}</p>
                            <p className="text-sm text-gray-600">{level.description}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Badge variant={level.supportsMultipleFiles ? 'default' : 'secondary'}>
                              {level.supportsMultipleFiles ? 'Multiple Files' : 'Single File'}
                            </Badge>
                            <Badge variant={level.requiresDivisionMapping ? 'default' : 'secondary'}>
                              {level.requiresDivisionMapping ? 'Division Mapping' : 'No Mapping'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Workflow Steps</h3>
                    <div className="space-y-2">
                      {setupWizardConfigManager.getConfig().workflowSteps.map((step) => (
                        <div key={step.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{step.title}</p>
                            <p className="text-sm text-gray-600">{step.description}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Badge variant={step.isRequired ? 'destructive' : 'secondary'}>
                              {step.isRequired ? 'Required' : 'Optional'}
                            </Badge>
                            <Badge variant={step.isVisible(setupWizardConfigManager.getConfig()) ? 'default' : 'secondary'}>
                              {step.isVisible(setupWizardConfigManager.getConfig()) ? 'Visible' : 'Hidden'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strategy Pattern */}
            <Card>
              <CardHeader>
                <CardTitle>Strategy Pattern - Import Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {importStrategyManager.getAvailableStrategies().map((strategy) => (
                    <div key={strategy.name} className="p-4 border rounded">
                      <h3 className="font-medium">{strategy.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{strategy.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Skip Button Text:</strong> {strategy.getSkipButtonText()}</p>
                          <p><strong>Skip Button Description:</strong> {strategy.getSkipButtonDescription()}</p>
                        </div>
                        <div>
                          <p><strong>Dropzone Text:</strong> {strategy.getDropzoneText()}</p>
                          <p><strong>Data Clearing Policy:</strong> {strategy.getDataClearingPolicy().join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="state" className="space-y-6">
            {/* Current State */}
            <Card>
              <CardHeader>
                <CardTitle>Current State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">State Machine</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Current State:</strong> {currentState}</p>
                      <p><strong>Business Config:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        <li>Import Level: {businessConfig.importLevel}</li>
                        <li>Multiple Divisions: {businessConfig.hasMultipleDivisions ? 'Yes' : 'No'}</li>
                        <li>Multiple Clusters: {businessConfig.hasMultipleClusters ? 'Yes' : 'No'}</li>
                        <li>Lifecycle Tracking: {businessConfig.enableLifecycleTracking ? 'Enabled' : 'Disabled'}</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Data Status</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>CSV Import Data:</strong> {csvImportData ? 'Present' : 'None'}</p>
                      <p><strong>Pending Divisions:</strong> {pendingDivisions.length}</p>
                      <p><strong>Pending Clusters:</strong> {pendingClusters.length}</p>
                      <p><strong>Lifecycle Mappings:</strong> {lifecycleMappings.length}</p>
                      <p><strong>Multiple CSV Import:</strong> {multipleCsvImport.isEnabled ? 'Enabled' : 'Disabled'}</p>
                      <p><strong>Imported CSV Files:</strong> {multipleCsvImport.importedCsvs.length}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Errors */}
            {Object.keys(validationErrors).length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-800">Validation Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(validationErrors).map(([step, errors]) => (
                    <div key={step} className="mb-4">
                      <h4 className="font-medium text-red-800 capitalize">{step} Step</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="commands" className="space-y-6">
            {/* Command History */}
            <Card>
              <CardHeader>
                <CardTitle>Command History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p><strong>Undo Stack Size:</strong> {undoStackSize}</p>
                      <p><strong>Redo Stack Size:</strong> {redoStackSize}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => commandManager.undo()}
                        disabled={!canUndo}
                      >
                        Undo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => commandManager.redo()}
                        disabled={!canRedo}
                      >
                        Redo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => commandManager.clearHistory()}
                      >
                        Clear History
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-2">Command Status</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Can Undo:</strong> {canUndo ? 'Yes' : 'No'}</p>
                      <p><strong>Can Redo:</strong> {canRedo ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Architecture Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>Architecture Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Before Refactoring</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                      <li>Scattered business logic</li>
                      <li>Hard to test</li>
                      <li>Difficult to maintain</li>
                      <li>Poor error handling</li>
                      <li>No undo/redo</li>
                      <li>Complex state management</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">After Refactoring</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-green-600">
                      <li>Centralized configuration</li>
                      <li>Testable components</li>
                      <li>Maintainable code</li>
                      <li>Robust error handling</li>
                      <li>Undo/redo support</li>
                      <li>Clean state management</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}; 