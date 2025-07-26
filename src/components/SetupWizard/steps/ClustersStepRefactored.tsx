import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { MapPin, Loader2, Trash2, CheckCircle, Archive, Plus, Edit, X, Building2 } from 'lucide-react';
import { EntityDeleteDialog } from '../../EntityManagement/EntityDeleteDialog';
import { InactiveEntitiesPanel } from '../../EntityManagement/InactiveEntitiesPanel';
import { useSetupWizardStoreRefactored } from '../../../store/setupWizardStoreRefactored';
import { commandManager } from '../../../commands/SetupWizardCommands';
import { setupWizardConfigManager } from '../../../config/SetupWizardConfig';
import { toast } from 'sonner';

interface ClustersStepRefactoredProps {
  onComplete?: () => void;
}

export const ClustersStepRefactored: React.FC<ClustersStepRefactoredProps> = ({
  onComplete
}) => {
  const {
    pendingDivisions,
    pendingClusters,
    deletedItems,
    showInactivePanel,
    inactivePanelEntityType,
    addCluster,
    updateCluster,
    deleteCluster,
    restoreCluster,
    setShowInactivePanel,
    setInactivePanelEntityType,
    nextStep,
    canProceedToNext
  } = useSetupWizardStoreRefactored();

  // Local state for forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCluster, setEditingCluster] = useState<number | null>(null);
  const [newCluster, setNewCluster] = useState({
    name: '',
    description: '',
    divisionId: '',
    divisionName: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    divisionId: '',
    divisionName: ''
  });

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<any>(null);

  // Get current step configuration
  const currentStep = setupWizardConfigManager.getWorkflowStep('clusters');

  // Handle add cluster
  const handleAddCluster = () => {
    if (!newCluster.name.trim()) {
      toast.error('Cluster name is required');
      return;
    }

    if (!newCluster.divisionId) {
      toast.error('Please select a division');
      return;
    }

    // Use command pattern to add cluster
    const command = commandManager.createCommand('AddClusterCommand', {
      name: newCluster.name,
      description: newCluster.description,
      divisionId: newCluster.divisionId,
      divisionName: newCluster.divisionName
    });

    commandManager.executeCommand(command);

    // Reset form
    setNewCluster({ name: '', description: '', divisionId: '', divisionName: '' });
    setShowAddForm(false);
    toast.success('Cluster added successfully');
  };

  // Handle edit cluster
  const handleEditCluster = (index: number) => {
    const cluster = pendingClusters[index];
    setEditForm({
      name: cluster.name,
      description: cluster.description || '',
      divisionId: cluster.divisionId?.toString() || '',
      divisionName: cluster.divisionName || ''
    });
    setEditingCluster(index);
  };

  // Handle update cluster
  const handleUpdateCluster = () => {
    if (!editForm.name.trim()) {
      toast.error('Cluster name is required');
      return;
    }

    if (!editForm.divisionId) {
      toast.error('Please select a division');
      return;
    }

    if (editingCluster !== null) {
      // Use command pattern to update cluster
      const command = commandManager.createCommand('UpdateClusterCommand', {
        index: editingCluster,
        updates: {
          name: editForm.name,
          description: editForm.description,
          divisionId: parseInt(editForm.divisionId),
          divisionName: editForm.divisionName
        }
      });

      commandManager.executeCommand(command);

      setEditingCluster(null);
      setEditForm({ name: '', description: '', divisionId: '', divisionName: '' });
      toast.success('Cluster updated successfully');
    }
  };

  // Handle delete cluster
  const handleDeleteCluster = (cluster: any) => {
    setClusterToDelete(cluster);
    setShowDeleteDialog(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (clusterToDelete) {
      // Use command pattern to delete cluster
      const command = commandManager.createCommand('DeleteClusterCommand', {
        index: pendingClusters.findIndex(c => c.id === clusterToDelete.id)
      });

      commandManager.executeCommand(command);

      setShowDeleteDialog(false);
      setClusterToDelete(null);
      toast.success('Cluster deleted successfully');
    }
  };

  // Handle restore cluster
  const handleRestoreCluster = (cluster: any) => {
    // Use command pattern to restore cluster
    const command = commandManager.createCommand('RestoreClusterCommand', {
      clusterId: cluster.id
    });

    commandManager.executeCommand(command);
    toast.success('Cluster restored successfully');
  };

  // Handle inactive panel toggle
  const handleToggleInactivePanel = () => {
    setInactivePanelEntityType('cluster');
    setShowInactivePanel(!showInactivePanel);
  };

  // Handle division selection for new cluster
  const handleDivisionSelect = (divisionId: string) => {
    const division = pendingDivisions.find(d => d.id.toString() === divisionId);
    setNewCluster({
      ...newCluster,
      divisionId,
      divisionName: division?.name || ''
    });
  };

  // Handle division selection for edit cluster
  const handleEditDivisionSelect = (divisionId: string) => {
    const division = pendingDivisions.find(d => d.id.toString() === divisionId);
    setEditForm({
      ...editForm,
      divisionId,
      divisionName: division?.name || ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{currentStep?.title || 'Create Clusters'}</h2>
        <p className="text-gray-600 mt-2">
          {currentStep?.description || 'Review and manage your clusters'}
        </p>
      </div>

      {/* Add Cluster Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Cluster
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
                <Label htmlFor="cluster-name">Cluster Name *</Label>
                <Input
                  id="cluster-name"
                  value={newCluster.name}
                  onChange={(e) => setNewCluster({ ...newCluster, name: e.target.value })}
                  placeholder="Enter cluster name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cluster-division">Division *</Label>
                <Select
                  value={newCluster.divisionId}
                  onValueChange={handleDivisionSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a division" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingDivisions.map((division) => (
                      <SelectItem key={division.id} value={division.id.toString()}>
                        {division.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster-description">Description</Label>
              <Textarea
                id="cluster-description"
                value={newCluster.description}
                onChange={(e) => setNewCluster({ ...newCluster, description: e.target.value })}
                placeholder="Enter cluster description"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCluster}>
                Add Cluster
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clusters List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Clusters ({pendingClusters.length})
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleInactivePanel}
              >
                <Archive className="h-4 w-4 mr-2" />
                Inactive ({deletedItems.clusters.length})
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Cluster
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingClusters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No clusters created yet.</p>
              <p className="text-sm">Click "Add Cluster" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingClusters.map((cluster, index) => (
                <div
                  key={cluster.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{cluster.name}</h3>
                      {cluster.isExisting && (
                        <Badge variant="secondary">Existing</Badge>
                      )}
                      {cluster.sourceFile && (
                        <Badge variant="outline">From CSV</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="h-3 w-3 text-gray-400" />
                      <span className="text-sm text-gray-600">{cluster.divisionName}</span>
                    </div>
                    {cluster.description && (
                      <p className="text-sm text-gray-600 mt-1">{cluster.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {editingCluster === index ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCluster(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateCluster}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCluster(index)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCluster(cluster)}
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

      {/* Edit Cluster Form */}
      {editingCluster !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Cluster
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingCluster(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cluster-name">Cluster Name *</Label>
                <Input
                  id="edit-cluster-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Enter cluster name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cluster-division">Division *</Label>
                <Select
                  value={editForm.divisionId}
                  onValueChange={handleEditDivisionSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a division" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingDivisions.map((division) => (
                      <SelectItem key={division.id} value={division.id.toString()}>
                        {division.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cluster-description">Description</Label>
              <Textarea
                id="edit-cluster-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Enter cluster description"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingCluster(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateCluster}>
                Update Cluster
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inactive Entities Panel */}
      {showInactivePanel && (
        <InactiveEntitiesPanel
          entityType="cluster"
          onClose={() => setShowInactivePanel(false)}
          onEntityRestored={handleRestoreCluster}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <EntityDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        entityType="cluster"
        entityName={clusterToDelete?.name}
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