import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Package, Plus, Edit, X, Trash2, CheckCircle } from 'lucide-react';
import { useSetupWizardStoreRefactored } from '../../../store/setupWizardStoreRefactored';
import { commandManager } from '../../../commands/SetupWizardCommands';
import { setupWizardConfigManager } from '../../../config/SetupWizardConfig';
import { toast } from 'sonner';

interface ProductLifecycleStepRefactoredProps {
  onComplete?: () => void;
}

interface LifecycleMapping {
  id: string;
  value: string;
  phase: 'launch' | 'growth' | 'end-of-life';
  isCustom?: boolean;
}

export const ProductLifecycleStepRefactored: React.FC<ProductLifecycleStepRefactoredProps> = ({
  onComplete
}) => {
  const {
    lifecycleMappings,
    businessConfig,
    updateLifecycleMappings,
    nextStep,
    canProceedToNext
  } = useSetupWizardStoreRefactored();

  // Local state for forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMapping, setEditingMapping] = useState<number | null>(null);
  const [newMapping, setNewMapping] = useState({
    value: '',
    phase: 'launch' as 'launch' | 'growth' | 'end-of-life'
  });
  const [editForm, setEditForm] = useState({
    value: '',
    phase: 'launch' as 'launch' | 'growth' | 'end-of-life'
  });

  // Get current step configuration
  const currentStep = setupWizardConfigManager.getWorkflowStep('product-lifecycle');

  // Check if lifecycle tracking is enabled
  if (!businessConfig.enableLifecycleTracking) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Product Lifecycle Tracking</h2>
          <p className="text-gray-600 mt-2">
            Product lifecycle tracking is not enabled in your business configuration.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Package className="h-16 w-16 mx-auto text-gray-300" />
              <p className="text-gray-600">
                To configure product lifecycle mappings, please enable lifecycle tracking in the Business Configuration step.
              </p>
              <Button onClick={onComplete || nextStep}>
                Continue to Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle add mapping
  const handleAddMapping = () => {
    if (!newMapping.value.trim()) {
      toast.error('Lifecycle value is required');
      return;
    }

    // Check for duplicates
    const isDuplicate = lifecycleMappings.some(
      mapping => mapping.value.toLowerCase() === newMapping.value.toLowerCase()
    );

    if (isDuplicate) {
      toast.error('This lifecycle value already exists');
      return;
    }

    // Use command pattern to add mapping
    const command = commandManager.createCommand('AddLifecycleMappingCommand', {
      value: newMapping.value,
      phase: newMapping.phase
    });

    commandManager.executeCommand(command);

    // Reset form
    setNewMapping({ value: '', phase: 'launch' });
    setShowAddForm(false);
    toast.success('Lifecycle mapping added successfully');
  };

  // Handle edit mapping
  const handleEditMapping = (index: number) => {
    const mapping = lifecycleMappings[index];
    setEditForm({
      value: mapping.value,
      phase: mapping.phase
    });
    setEditingMapping(index);
  };

  // Handle update mapping
  const handleUpdateMapping = () => {
    if (!editForm.value.trim()) {
      toast.error('Lifecycle value is required');
      return;
    }

    if (editingMapping !== null) {
      // Check for duplicates (excluding current item)
      const isDuplicate = lifecycleMappings.some(
        (mapping, index) => 
          index !== editingMapping && 
          mapping.value.toLowerCase() === editForm.value.toLowerCase()
      );

      if (isDuplicate) {
        toast.error('This lifecycle value already exists');
        return;
      }

      // Use command pattern to update mapping
      const command = commandManager.createCommand('UpdateLifecycleMappingCommand', {
        index: editingMapping,
        updates: {
          value: editForm.value,
          phase: editForm.phase
        }
      });

      commandManager.executeCommand(command);

      setEditingMapping(null);
      setEditForm({ value: '', phase: 'launch' });
      toast.success('Lifecycle mapping updated successfully');
    }
  };

  // Handle delete mapping
  const handleDeleteMapping = (index: number) => {
    // Use command pattern to delete mapping
    const command = commandManager.createCommand('DeleteLifecycleMappingCommand', {
      index
    });

    commandManager.executeCommand(command);
    toast.success('Lifecycle mapping deleted successfully');
  };

  // Get phase color
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'launch':
        return 'bg-blue-100 text-blue-800';
      case 'growth':
        return 'bg-green-100 text-green-800';
      case 'end-of-life':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get phase icon
  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'launch':
        return '🚀';
      case 'growth':
        return '📈';
      case 'end-of-life':
        return '📉';
      default:
        return '📦';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{currentStep?.title || 'Product Lifecycle'}</h2>
        <p className="text-gray-600 mt-2">
          {currentStep?.description || 'Configure product lifecycle phase mappings'}
        </p>
      </div>

      {/* Add Mapping Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Lifecycle Mapping
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lifecycle-value">Lifecycle Value *</Label>
                <Input
                  id="lifecycle-value"
                  value={newMapping.value}
                  onChange={(e) => setNewMapping({ ...newMapping, value: e.target.value })}
                  placeholder="e.g., New Product, Mature, Discontinued"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lifecycle-phase">Phase *</Label>
                <Select
                  value={newMapping.phase}
                  onValueChange={(value: 'launch' | 'growth' | 'end-of-life') => 
                    setNewMapping({ ...newMapping, phase: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="launch">
                      <span className="flex items-center gap-2">
                        <span>🚀</span>
                        <span>Launch</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="growth">
                      <span className="flex items-center gap-2">
                        <span>📈</span>
                        <span>Growth</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="end-of-life">
                      <span className="flex items-center gap-2">
                        <span>📉</span>
                        <span>End of Life</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMapping}>
                Add Mapping
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lifecycle Mappings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Lifecycle Mappings ({lifecycleMappings.length})
            </span>
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lifecycleMappings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No lifecycle mappings configured yet.</p>
              <p className="text-sm">Click "Add Mapping" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lifecycleMappings.map((mapping, index) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{mapping.value}</h3>
                      <Badge className={getPhaseColor(mapping.phase)}>
                        <span className="mr-1">{getPhaseIcon(mapping.phase)}</span>
                        {mapping.phase.charAt(0).toUpperCase() + mapping.phase.slice(1)}
                      </Badge>
                      {mapping.isCustom && (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {editingMapping === index ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMapping(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateMapping}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditMapping(index)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMapping(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Mapping Form */}
      {editingMapping !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Lifecycle Mapping
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingMapping(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-lifecycle-value">Lifecycle Value *</Label>
                <Input
                  id="edit-lifecycle-value"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  placeholder="e.g., New Product, Mature, Discontinued"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lifecycle-phase">Phase *</Label>
                <Select
                  value={editForm.phase}
                  onValueChange={(value: 'launch' | 'growth' | 'end-of-life') => 
                    setEditForm({ ...editForm, phase: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="launch">
                      <span className="flex items-center gap-2">
                        <span>🚀</span>
                        <span>Launch</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="growth">
                      <span className="flex items-center gap-2">
                        <span>📈</span>
                        <span>Growth</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="end-of-life">
                      <span className="flex items-center gap-2">
                        <span>📉</span>
                        <span>End of Life</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingMapping(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateMapping}>
                Update Mapping
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Phase Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl mb-2">🚀</div>
              <h3 className="font-medium text-blue-800">Launch</h3>
              <p className="text-sm text-blue-600">
                {lifecycleMappings.filter(m => m.phase === 'launch').length} mappings
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl mb-2">📈</div>
              <h3 className="font-medium text-green-800">Growth</h3>
              <p className="text-sm text-green-600">
                {lifecycleMappings.filter(m => m.phase === 'growth').length} mappings
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl mb-2">📉</div>
              <h3 className="font-medium text-red-800">End of Life</h3>
              <p className="text-sm text-red-600">
                {lifecycleMappings.filter(m => m.phase === 'end-of-life').length} mappings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => {}}>
          Previous
        </Button>
        <Button 
          onClick={onComplete || nextStep}
          disabled={!canProceedToNext}
        >
          Next Step
        </Button>
      </div>

      {/* Command History (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 text-sm">Command History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-blue-700">
              <p><strong>Undo Stack:</strong> {commandManager.getUndoStackSize()}</p>
              <p><strong>Redo Stack:</strong> {commandManager.getRedoStackSize()}</p>
              <p><strong>Can Undo:</strong> {commandManager.canUndo() ? 'Yes' : 'No'}</p>
              <p><strong>Can Redo:</strong> {commandManager.canRedo() ? 'Yes' : 'No'}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 