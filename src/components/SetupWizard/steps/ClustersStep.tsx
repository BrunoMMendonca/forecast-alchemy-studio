import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { CheckCircle, MapPin, Plus, Trash2, Archive, Loader2 } from 'lucide-react';
import { EntityDeleteDialog } from '../../EntityManagement/EntityDeleteDialog';
import { InactiveEntitiesPanel } from '../../EntityManagement/InactiveEntitiesPanel';
import { useSetupWizardStore } from '../../../store/setupWizardStore';
import { toast } from 'sonner';

interface ClustersStepProps {
  orgStructure: any;
  pendingDivisions: any[];
  pendingClusters: any[];
  divisions: any[];
  clusters: any[];
  editingCluster: number | null;
  editClusterForm: any;
  isLoadingClusters: boolean;
  newCluster: any;
  setCurrentStep: (step: number) => void;
  getStepIndexByTitle: (title: string) => number;
  safeSetEditingCluster: (index: number | null) => void;
  safeSetEditClusterForm: (form: any) => void;
  safeCreateCluster: () => void;
  safeSetNewCluster: (updates: any) => void;
  handleUpdatePendingCluster: () => void;
}

export const ClustersStep: React.FC<ClustersStepProps> = ({
  orgStructure,
  pendingDivisions,
  pendingClusters,
  divisions: propDivisions, // Rename to avoid confusion
  clusters: propClusters, // Rename to avoid confusion
  editingCluster,
  editClusterForm,
  isLoadingClusters,
  newCluster,
  setCurrentStep,
  getStepIndexByTitle,
  safeSetEditingCluster,
  safeSetEditClusterForm,
  safeCreateCluster,
  safeSetNewCluster,
  handleUpdatePendingCluster
}) => {
  // Delete functionality state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInactivePanel, setShowInactivePanel] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<any>(null);
  const { 
    deleteCluster, 
    loadClusters, 
    setOrgStructure, 
    orgStructure: storeOrgStructure,
    divisions: storeDivisions, // Get divisions directly from store
    clusters: storeClusters, // Get clusters directly from store
    isLoadingClusters: storeIsLoadingClusters,
    deletePendingCluster // Add deletePendingCluster to the store
  } = useSetupWizardStore();

  // Use pending clusters as single source of truth
  const clusters = storeOrgStructure?.pendingClusters || [];
  const divisions = storeOrgStructure?.pendingDivisions || [];
  const isLoadingClustersFromStore = storeIsLoadingClusters !== undefined ? storeIsLoadingClusters : isLoadingClusters;

  // Debug logging for real-time updates
  console.log('[ClustersStep] Pending clusters (single source):', clusters?.length || 0);
  console.log('[ClustersStep] Store loading:', storeIsLoadingClusters);
  console.log('[ClustersStep] Final loading:', isLoadingClustersFromStore);

  // Handle step navigation in useEffect to avoid setState during render
  useEffect(() => {
    // Only auto-navigate if this is the initial load and the step should be skipped
    // Don't auto-navigate when user deletes clusters and loses context
    if (!orgStructure.hasMultipleClusters && orgStructure.setupFlow?.skipClusterStep) {
      // Skip to S&OP cycles step only on initial load
      setCurrentStep(getStepIndexByTitle('S&OP Cycles'));
    }
  }, [orgStructure.setupFlow?.skipClusterStep]);

  // Get pendingDivisions and pendingClusters directly from store to ensure reactivity
  const storePendingDivisions = storeOrgStructure?.pendingDivisions || [];
  const effectivePendingDivisions = storePendingDivisions.length > 0 ? storePendingDivisions : pendingDivisions;
  const storePendingClusters = storeOrgStructure?.pendingClusters || [];
  const effectivePendingClusters = storePendingClusters.length > 0 ? storePendingClusters : pendingClusters;
  
  // Handle delete cluster
  const handleDeleteCluster = async (cluster: any) => {
    // All clusters are now in pending clusters with isExisting flag
    setClusterToDelete(cluster);
    setShowDeleteDialog(true);
  };

  // Handle delete pending cluster (from Zustand store)
  const handleDeletePendingCluster = (index: number) => {
    console.log('Deleting pending cluster at index:', index);
    console.log('Current effectivePendingClusters:', effectivePendingClusters);
    
    // Get the cluster to delete
    const clusterToDelete = effectivePendingClusters[index];
    if (!clusterToDelete) {
      console.error('Cluster not found at index:', index);
      return;
    }
    
    // Use the store's deletePendingCluster function to properly handle deletion
    // This will add the cluster to deletedItems for restoration
    // For existing clusters (from DB), pass the ID; for new clusters, pass the index
    const idOrIndex = clusterToDelete.isExisting && clusterToDelete.id ? clusterToDelete.id : index;
    console.log('Calling deletePendingCluster with:', { idOrIndex, clusterToDelete });
    
    const result = deletePendingCluster(idOrIndex);
    
    if (result.success) {
      console.log('Successfully deleted pending cluster:', clusterToDelete.name);
    } else {
      console.error('Failed to delete pending cluster:', result.error);
      toast.error('Failed to delete cluster');
    }
  };

  // Confirm delete
  const confirmDelete = async (forceHardDelete?: boolean) => {
    if (!clusterToDelete) return;
    
    console.log('confirmDelete called with:', {
      clusterToDelete,
      id: clusterToDelete.id,
      forceHardDelete
    });
    
    // Use pending delete function for Setup Wizard flow
    // For existing clusters (from DB), pass the ID; for new clusters, pass the index
    const idOrIndex = clusterToDelete.isExisting && clusterToDelete.id ? clusterToDelete.id : clusterToDelete.id || 0;
    console.log('Calling deletePendingCluster from confirmDelete with:', { idOrIndex, clusterToDelete });
    
    const result = deletePendingCluster(idOrIndex);
    
    if (result.success) {
      setShowDeleteDialog(false);
      setClusterToDelete(null);
    }
    
    return {
      ...result,
      method: (forceHardDelete ? 'hard' : 'soft') as 'soft' | 'hard'
    };
  };
  
  // Clusters step - only hide if step is explicitly skipped
  if (orgStructure.setupFlow?.skipClusterStep) {
    // Return null while useEffect handles navigation
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-blue-600" />
            Create Clusters
          </CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-gray-600 dark:text-gray-400">
              {(() => {
                const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                                   orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                                   orgStructure.hasMultipleClusters;
                
                if (isDivisionLevelWithoutColumn) {
                  return 'Edit clusters imported from CSV and add additional clusters. Clusters represent geographic regions or operational units within divisions.';
                }
                return 'Clusters represent geographic regions or operational units within divisions';
              })()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactivePanel(true)}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Inactive Clusters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manual Cluster Creation */}
         

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {editingCluster !== null ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit Cluster</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        safeSetEditingCluster(null);
                        safeSetEditClusterForm({ name: '', description: '', countryCode: '', region: '', fieldMapping: '' });
                      }}
                      className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white dark:text-red-400 dark:border-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="editClusterName">Cluster Name *</Label>
                    <Input
                      id="editClusterName"
                      value={editClusterForm.name}
                      onChange={(e) => safeSetEditClusterForm({ name: e.target.value })}
                      placeholder="e.g., North America"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editClusterDescription">Description</Label>
                    <Textarea
                      id="editClusterDescription"
                      value={editClusterForm.description}
                      onChange={(e) => safeSetEditClusterForm({ description: e.target.value })}
                      placeholder="Brief description of this cluster"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="editCountryCode">Country Code</Label>
                      <Input
                        id="editCountryCode"
                        value={editClusterForm.countryCode}
                        onChange={(e) => safeSetEditClusterForm({ countryCode: e.target.value })}
                        placeholder="e.g., US"
                      />
                    </div>
                    <div>
                      <Label htmlFor="editRegion">Region</Label>
                      <Input
                        id="editRegion"
                        value={editClusterForm.region}
                        onChange={(e) => safeSetEditClusterForm({ region: e.target.value })}
                        placeholder="e.g., North America"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="editClusterFieldMapping">Field Mapping *</Label>
                    <Input
                      id="editClusterFieldMapping"
                      value={editClusterForm.fieldMapping || ''}
                      onChange={e => safeSetEditClusterForm({ fieldMapping: e.target.value })}
                      placeholder="e.g. CL1, C01, etc. (from CSV column)"
                    />
                  </div>
                  <Button onClick={handleUpdatePendingCluster} className="w-full" disabled={isLoadingClustersFromStore}>
                    {isLoadingClustersFromStore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Cluster'
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="clusterDivision">Division *</Label>
                    <Select value={newCluster.divisionId} onValueChange={(value) => safeSetNewCluster({ divisionId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a division first" />
                      </SelectTrigger>
                      <SelectContent>
                        {effectivePendingDivisions
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((division, index) => {
                          const divisionObj = (storeDivisions || propDivisions).find(d => d.name === division.name);
                          
                          // Check if division exists in database
                          if (divisionObj && typeof divisionObj.id === 'number') {
                            // Division exists in database - use its ID
                            return (
                              <SelectItem key={`cluster-division-${index}`} value={divisionObj.id.toString()}>
                            {division.name}
                          </SelectItem>
                            );
                          } else {
                            // Division is pending (from CSV) - use negative index
                            const pendingIndex = effectivePendingDivisions.findIndex(d => d.name === division.name);
                            if (pendingIndex >= 0) {
                              return (
                                <SelectItem key={`cluster-division-${index}`} value={`pending-${pendingIndex}`}>
                                  {division.name} (Pending)
                                </SelectItem>
                              );
                            }
                          }
                          return null;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="clusterName">Cluster Name *</Label>
                    <Input
                      id="clusterName"
                      value={newCluster.name}
                      onChange={(e) => safeSetNewCluster({ name: e.target.value })}
                      placeholder="e.g., North America"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clusterDescription">Description</Label>
                    <Textarea
                      id="clusterDescription"
                      value={newCluster.description}
                      onChange={(e) => safeSetNewCluster({ description: e.target.value })}
                      placeholder="Brief description of this cluster"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="countryCode">Country Code</Label>
                      <Input
                        id="countryCode"
                        value={newCluster.countryCode}
                        onChange={(e) => safeSetNewCluster({ countryCode: e.target.value })}
                        placeholder="e.g., US"
                      />
                    </div>
                    <div>
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        value={newCluster.region}
                        onChange={(e) => safeSetNewCluster({ region: e.target.value })}
                        placeholder="e.g., North America"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="clusterFieldMapping">Field Mapping *</Label>
                    <Input
                      id="clusterFieldMapping"
                      value={newCluster.fieldMapping || ''}
                      onChange={e => safeSetNewCluster({ fieldMapping: e.target.value })}
                      placeholder="e.g. CL1, C01, etc. (from CSV column)"
                    />
                  </div>
                  <Button onClick={safeCreateCluster} className="w-full" disabled={isLoadingClustersFromStore}>
                    {isLoadingClustersFromStore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Cluster'
                    )}
                  </Button>
                </>
              )}
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Clusters</h3>
              
              {/* Divisions and their clusters */}
              {isLoadingClustersFromStore ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading clusters...</p>
                </div>
              ) : effectivePendingDivisions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No divisions available</p>
              ) : (
                <div className="space-y-4">
                  {effectivePendingDivisions
                    .map((division, divisionIndex) => {
                    // Simply filter clusters by divisionName - this should already be correctly assigned
                    const divisionClusters = effectivePendingClusters.filter(cluster => 
                      cluster.divisionName === division.name
                    );
                    
                    return (
                      <div key={`division-clusters-${divisionIndex}`} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4" />
                              {division.name}
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              {divisionClusters.length} cluster{divisionClusters.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3 space-y-2">
                          {divisionClusters.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No clusters for this division</p>
                          ) : (
                            <div className="space-y-2">
                              {divisionClusters
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((cluster, clusterIndex) => {
                                // Use the isExisting flag from the combined array
                                const isExisting = cluster.isExisting;
                                const isSelected = editingCluster === effectivePendingClusters.findIndex(c => c.name === cluster.name);
                                
                                return (
                                  <div
                                    key={`cluster-${clusterIndex}`}
                                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                      isSelected
                                        ? isExisting 
                                          ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-300 dark:border-green-600 shadow-md' 
                                          : 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-300 dark:border-blue-600 shadow-md'
                                        : isExisting 
                                          ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/20 opacity-75' 
                                          : 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 opacity-75'
                                    }`}
                                    onClick={() => {
                                      const globalClusterIndex = effectivePendingClusters.findIndex(c => c.name === cluster.name);
                                      if (globalClusterIndex !== -1) {
                                        if (editingCluster === globalClusterIndex) {
                                          safeSetEditingCluster(null);
                                          setTimeout(() => {
                                            safeSetEditingCluster(globalClusterIndex);
                                            safeSetEditClusterForm({
                                              name: cluster.name,
                                              description: cluster.description || '',
                                              countryCode: cluster.countryCode || '',
                                              region: cluster.region || '',
                                              fieldMapping: cluster.fieldMapping || cluster.name || ''
                                            });
                                          }, 0);
                                        } else {
                                          safeSetEditingCluster(globalClusterIndex);
                                          safeSetEditClusterForm({
                                            name: cluster.name,
                                            description: cluster.description || '',
                                            countryCode: cluster.countryCode || '',
                                            region: cluster.region || '',
                                            fieldMapping: cluster.fieldMapping || cluster.name || ''
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        {isSelected && (
                                          <div className={`w-2 h-2 rounded-full ${
                                            isExisting ? 'bg-green-500' : 'bg-blue-500'
                                          }`}></div>
                                        )}
                                        <MapPin className="h-3 w-3 text-blue-600" />
                                        <p className={`font-medium ${
                                          isSelected 
                                            ? 'text-gray-900 dark:text-gray-100' 
                                            : 'text-gray-700 dark:text-gray-300'
                                        }`}>{cluster.name}</p>
                                        {isExisting ? (
                                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            Existing
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            New
                                          </Badge>
                                        )}
                                      </div>
                                      {cluster.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{cluster.description}</p>
                                      )}
                                      {(cluster.countryCode || cluster.region) && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                          {cluster.countryCode && cluster.region 
                                            ? `${cluster.countryCode} - ${cluster.region}`
                                            : cluster.countryCode || cluster.region
                                          }
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isExisting ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <CheckCircle className="h-4 w-4 text-blue-500" />
                                      )}
                                      {isExisting ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCluster(cluster);
                                          }}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const globalClusterIndex = effectivePendingClusters.findIndex(c => c.name === cluster.name);
                                            if (globalClusterIndex !== -1) {
                                              handleDeletePendingCluster(globalClusterIndex);
                                            }
                                          }}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Delete Dialog */}
      {showDeleteDialog && clusterToDelete && (
        <EntityDeleteDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setClusterToDelete(null);
          }}
          onConfirm={confirmDelete}
          entityName={clusterToDelete.name}
          entityType="cluster"
          entityId={clusterToDelete.id}
          onSuccess={() => {
            // deleteCluster already handles the refresh, no need to call loadClusters again
          }}
        />
      )}
      
      {/* Inactive Entities Panel */}
      <InactiveEntitiesPanel
        isOpen={showInactivePanel}
        onClose={() => setShowInactivePanel(false)}
        onEntityRestored={() => {
          console.log('[ClustersStep] Entity restored, forcing clusters reload');
          loadClusters(true); // Force reload to get fresh data
          // Don't close the panel - let user close it manually
        }}
        entityType="cluster"
      />
    </div>
  );
}; 