import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Building2, Loader2, Trash2, Landmark, CheckCircle, Archive, Plus, Edit, X } from 'lucide-react';
import { EntityDeleteDialog } from '../../EntityManagement/EntityDeleteDialog';
import { InactiveEntitiesPanel } from '../../EntityManagement/InactiveEntitiesPanel';
import { useSetupWizardStoreRefactored } from '../../../store/setupWizardStoreRefactored';
import { commandManager } from '../../../commands/SetupWizardCommands';
import { setupWizardConfigManager } from '../../../config/SetupWizardConfig';
import { toast } from 'sonner';

interface DivisionsStepRefactoredProps {
  onComplete?: () => void;
}

export const DivisionsStepRefactored: React.FC<DivisionsStepRefactoredProps> = ({
  onComplete
}) => {
  const {
    pendingDivisions,
    deletedItems,
    showInactivePanel,
    inactivePanelEntityType,
    addDivision,
    updateDivision,
    deleteDivision,
    restoreDivision,
    setShowInactivePanel,
    setInactivePanelEntityType,
    nextStep,
    canProceedToNext
  } = useSetupWizardStoreRefactored();

  // Local state for forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDivision, setEditingDivision] = useState<number | null>(null);
  const [newDivision, setNewDivision] = useState({
    name: '',
    description: '',
    industry: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    industry: ''
  });

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [divisionToDelete, setDivisionToDelete] = useState<any>(null);

  // Get current step configuration
  const currentStep = setupWizardConfigManager.getWorkflowStep('divisions');

  // Handle add division
  const handleAddDivision = () => {
    if (!newDivision.name.trim()) {
      toast.error('Division name is required');
      return;
    }

    // Use command pattern to add division
    const command = commandManager.createCommand('AddDivisionCommand', {
      name: newDivision.name,
      description: newDivision.description,
      industry: newDivision.industry
    });

    commandManager.executeCommand(command);

    // Reset form
    setNewDivision({ name: '', description: '', industry: '' });
    setShowAddForm(false);
    toast.success('Division added successfully');
  };

  // Handle edit division
  const handleEditDivision = (index: number) => {
    const division = pendingDivisions[index];
    setEditForm({
      name: division.name,
      description: division.description || '',
      industry: division.industry || ''
    });
    setEditingDivision(index);
  };

  // Handle update division
  const handleUpdateDivision = () => {
    if (!editForm.name.trim()) {
      toast.error('Division name is required');
      return;
    }

    if (editingDivision !== null) {
      // Use command pattern to update division
      const command = commandManager.createCommand('UpdateDivisionCommand', {
        index: editingDivision,
        updates: {
          name: editForm.name,
          description: editForm.description,
          industry: editForm.industry
        }
      });

      commandManager.executeCommand(command);

      setEditingDivision(null);
      setEditForm({ name: '', description: '', industry: '' });
      toast.success('Division updated successfully');
    }
  };

  // Handle delete division
  const handleDeleteDivision = (division: any) => {
    setDivisionToDelete(division);
    setShowDeleteDialog(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (divisionToDelete) {
      // Use command pattern to delete division
      const command = commandManager.createCommand('DeleteDivisionCommand', {
        index: pendingDivisions.findIndex(d => d.id === divisionToDelete.id)
      });

      commandManager.executeCommand(command);

      setShowDeleteDialog(false);
      setDivisionToDelete(null);
      toast.success('Division deleted successfully');
    }
  };

  // Handle restore division
  const handleRestoreDivision = (division: any) => {
    // Use command pattern to restore division
    const command = commandManager.createCommand('RestoreDivisionCommand', {
      divisionId: division.id
    });

    commandManager.executeCommand(command);
    toast.success('Division restored successfully');
  };

  // Handle inactive panel toggle
  const handleToggleInactivePanel = () => {
    setInactivePanelEntityType('division');
    setShowInactivePanel(!showInactivePanel);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{currentStep?.title || 'Create Divisions'}</h2>
        <p className="text-gray-600 mt-2">
          {currentStep?.description || 'Review and manage your divisions'}
        </p>
      </div>

      {/* Add Division Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Division
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
                <Label htmlFor="division-name">Division Name *</Label>
                <Input
                  id="division-name"
                  value={newDivision.name}
                  onChange={(e) => setNewDivision({ ...newDivision, name: e.target.value })}
                  placeholder="Enter division name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="division-industry">Industry</Label>
                <Input
                  id="division-industry"
                  value={newDivision.industry}
                  onChange={(e) => setNewDivision({ ...newDivision, industry: e.target.value })}
                  placeholder="Enter industry"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="division-description">Description</Label>
              <Textarea
                id="division-description"
                value={newDivision.description}
                onChange={(e) => setNewDivision({ ...newDivision, description: e.target.value })}
                placeholder="Enter division description"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDivision}>
                Add Division
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Divisions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Divisions ({pendingDivisions.length})
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleInactivePanel}
              >
                <Archive className="h-4 w-4 mr-2" />
                Inactive ({deletedItems.divisions.length})
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Division
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingDivisions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No divisions created yet.</p>
              <p className="text-sm">Click "Add Division" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDivisions.map((division, index) => (
                <div
                  key={division.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{division.name}</h3>
                      {division.isExisting && (
                        <Badge variant="secondary">Existing</Badge>
                      )}
                      {division.sourceFile && (
                        <Badge variant="outline">From CSV</Badge>
                      )}
                    </div>
                    {division.description && (
                      <p className="text-sm text-gray-600 mt-1">{division.description}</p>
                    )}
                    {division.industry && (
                      <p className="text-sm text-gray-500 mt-1">
                        <Landmark className="h-3 w-3 inline mr-1" />
                        {division.industry}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {editingDivision === index ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingDivision(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateDivision}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDivision(index)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDivision(division)}
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

      {/* Edit Division Form */}
      {editingDivision !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Division
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingDivision(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-division-name">Division Name *</Label>
                <Input
                  id="edit-division-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Enter division name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-division-industry">Industry</Label>
                <Input
                  id="edit-division-industry"
                  value={editForm.industry}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  placeholder="Enter industry"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-division-description">Description</Label>
              <Textarea
                id="edit-division-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Enter division description"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingDivision(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDivision}>
                Update Division
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inactive Entities Panel */}
      {showInactivePanel && (
        <InactiveEntitiesPanel
          entityType="division"
          onClose={() => setShowInactivePanel(false)}
          onEntityRestored={handleRestoreDivision}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <EntityDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        entityType="division"
        entityName={divisionToDelete?.name}
      />

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