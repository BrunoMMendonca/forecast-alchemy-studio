import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Building2, Loader2, Trash2, Landmark, CheckCircle, Archive } from 'lucide-react';
import { EntityDeleteDialog } from '../../EntityManagement/EntityDeleteDialog';
import { InactiveEntitiesPanel } from '../../EntityManagement/InactiveEntitiesPanel';
import { useSetupWizardStore } from '../../../store/setupWizardStoreRefactored';
import { toast } from 'sonner';

interface DivisionsStepProps {
  orgStructure: any;
  pendingDivisions: any[];
  divisions: any[];
  editingDivision: number | null;
  editDivisionForm: any;
  isLoadingDivisions: boolean;
  newDivision: any;
  setCurrentStep: (step: number) => void;
  getStepIndexByTitle: (title: string) => number;
  safeSetEditingDivision: (index: number | null) => void;
  safeSetEditDivisionForm: (form: any) => void;
  safeCreateDivision: () => void;
  safeSetNewDivision: (updates: any) => void;
  handleUpdatePendingDivision: () => void;
  onBack?: () => void;
}

export const DivisionsStep: React.FC<DivisionsStepProps> = ({
  orgStructure,
  pendingDivisions,
  divisions: propDivisions, // Rename to avoid confusion
  editingDivision,
  editDivisionForm,
  isLoadingDivisions,
  newDivision,
  setCurrentStep,
  getStepIndexByTitle,
  safeSetEditingDivision,
  safeSetEditDivisionForm,
  safeCreateDivision,
  safeSetNewDivision,
  handleUpdatePendingDivision,
  onBack
}) => {
  // Delete functionality state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInactivePanel, setShowInactivePanel] = useState(false);
  const [divisionToDelete, setDivisionToDelete] = useState<any>(null);
  const { 
    deletePendingDivision, 
    restorePendingDivision,
    loadDivisions, 
    setOrgStructure, 
    orgStructure: storeOrgStructure,
    divisions: storeDivisions, // Get divisions directly from store
    isLoadingDivisions: storeIsLoadingDivisions
  } = useSetupWizardStore();

  // Use pending divisions as single source of truth
  const divisions = storeOrgStructure?.pendingDivisions || [];
  
  console.log('🔍 DivisionsStep - Current divisions state:', {
    totalDivisions: divisions.length,
    divisions: divisions.map(d => ({
      name: d.name,
      id: d.id,
      isExisting: d.isExisting,
      description: d.description
    })),
    storeDivisions: storeDivisions.map(d => ({
      name: d.name,
      id: d.id
    })),
    pendingDivisions: storeOrgStructure?.pendingDivisions?.map(d => ({
      name: d.name,
      id: d.id,
      isExisting: d.isExisting
    }))
  });
  const isLoadingDivisionsFromStore = storeIsLoadingDivisions !== undefined ? storeIsLoadingDivisions : isLoadingDivisions;

  // Keyboard event handler for Enter key
  const handleKeyPress = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  };

  // Handle step navigation in useEffect to avoid setState during render
  useEffect(() => {
    // Only auto-navigate if this is the initial load and the step should be skipped
    // Don't auto-navigate when user deletes divisions and loses context
    if (!orgStructure.hasMultipleDivisions && orgStructure.setupFlow?.skipDivisionStep) {
      // Skip to next appropriate step only on initial load
      const { hasMultipleClusters } = orgStructure;
      if (hasMultipleClusters && !orgStructure.setupFlow?.skipClusterStep) {
        setCurrentStep(getStepIndexByTitle('Clusters')); // Go to clusters
      } else {
        setCurrentStep(getStepIndexByTitle('S&OP Cycles')); // Go to S&OP cycles
      }
    }
  }, [orgStructure.setupFlow?.skipDivisionStep, orgStructure.setupFlow?.skipClusterStep]);

  // Handle delete division
  const handleDeleteDivision = async (division: any) => {
    // All divisions are now in pending divisions with isExisting flag
    setDivisionToDelete(division);
    setShowDeleteDialog(true);
  };

  // Handle delete pending division (from Zustand store)
  const handleDeletePendingDivision = (index: number) => {
    console.log('Deleting pending division at index:', index);
    console.log('Current divisions:', divisions);
    
    // Get the division to delete
    const divisionToDelete = divisions[index];
    if (!divisionToDelete) {
      console.error('Division not found at index:', index);
      return;
    }
    
    // Use the store's deletePendingDivision function to properly handle deletion
    // This will add the division to deletedItems for restoration
    // For existing divisions (from DB), pass the ID; for new divisions, pass the index
    const idOrIndex = divisionToDelete.isExisting && divisionToDelete.id ? divisionToDelete.id : index;
    console.log('Calling deletePendingDivision with:', { idOrIndex, divisionToDelete });
    
    const result = deletePendingDivision(idOrIndex);
    
    if (result.success) {
      console.log('Successfully deleted pending division:', divisionToDelete.name);
    } else {
      console.error('Failed to delete pending division:', result.error);
      toast.error('Failed to delete division');
    }
  };

  // Confirm delete
  const confirmDelete = async (forceHardDelete?: boolean) => {
    if (!divisionToDelete) return;
    
    console.log('confirmDelete called with:', {
      divisionToDelete,
      id: divisionToDelete.id,
      forceHardDelete
    });
    
    // Use pending delete function for Setup Wizard flow
    // For existing divisions (from DB), pass the ID; for new divisions, pass the index
    const idOrIndex = divisionToDelete.isExisting && divisionToDelete.id ? divisionToDelete.id : divisionToDelete.id || 0;
    console.log('Calling deletePendingDivision from confirmDelete with:', { idOrIndex, divisionToDelete });
    
    const result = deletePendingDivision(idOrIndex);
    
    if (result.success) {
      setShowDeleteDialog(false);
      setDivisionToDelete(null);
    }
    
    return {
      ...result,
      method: (forceHardDelete ? 'hard' : 'soft') as 'soft' | 'hard'
    };
  };

  // Divisions step - only hide if step is explicitly skipped
  if (orgStructure.setupFlow?.skipDivisionStep) {
    // Return null while useEffect handles navigation
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          {/*<CardTitle className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            Manage Divisions
          </CardTitle>*/}
          <div className="flex items-center justify-between">
            <p className="text-gray-600 dark:text-gray-400">
              {/*{(() => {
                const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                                   orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                                   orgStructure.hasMultipleClusters;
                
                if (isDivisionLevelWithoutColumn) {
                  return 'Create your divisions first, then upload CSV files to add clusters for each division';
                }
                return 'Divisions represent business units or product lines within your company';
              })()}*/}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactivePanel(true)}
              className="flex items-center gap-2"
            >
              <Archive className={`h-4 w-4 text-blue-600 ${
                storeOrgStructure?.deletedItems?.divisions?.length > 0 ? 'animate-pulse' : ''
              }`} />
              Inactive Divisions
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {editingDivision !== null ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit Division</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        safeSetEditingDivision(null);
                        safeSetEditDivisionForm({ name: '', description: '', industry: '', fieldMapping: '' });
                      }}
                      className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white dark:text-red-400 dark:border-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="editDivisionName">Division Name *</Label>
                    <Input
                      id="editDivisionName"
                      value={editDivisionForm.name}
                      onChange={(e) => safeSetEditDivisionForm({ name: e.target.value })}
                      placeholder="e.g., Consumer Products"
                      onKeyPress={(e) => handleKeyPress(e, handleUpdatePendingDivision)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDivisionDescription">Description</Label>
                    <Textarea
                      id="editDivisionDescription"
                      value={editDivisionForm.description}
                      onChange={(e) => safeSetEditDivisionForm({ description: e.target.value })}
                      placeholder="Brief description of this division"
                      rows={3}
                      onKeyPress={(e) => handleKeyPress(e, handleUpdatePendingDivision)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDivisionIndustry">Industry</Label>
                    <Input
                      id="editDivisionIndustry"
                      value={editDivisionForm.industry}
                      onChange={(e) => safeSetEditDivisionForm({ industry: e.target.value })}
                      placeholder="e.g., Consumer Goods"
                      onKeyPress={(e) => handleKeyPress(e, handleUpdatePendingDivision)}
                    />
                  </div>
                  {(() => {
                    const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                                       orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                                       orgStructure.hasMultipleClusters;
                    
                    // Don't show field mapping for division-level without column workflow
                    if (isDivisionLevelWithoutColumn) {
                      return null;
                    }
                    
                    return (
                      <div>
                        <Label htmlFor="editDivisionFieldMapping">Field Mapping *</Label>
                        <Input
                          id="editDivisionFieldMapping"
                          value={editDivisionForm.fieldMapping || ''}
                          onChange={(e) => safeSetEditDivisionForm({ fieldMapping: e.target.value })}
                          placeholder="e.g. CD1, D01, etc. (from CSV column)"
                          onKeyPress={(e) => handleKeyPress(e, handleUpdatePendingDivision)}
                        />
                      </div>
                    );
                  })()}

                  <Button onClick={handleUpdatePendingDivision} className="w-full" disabled={isLoadingDivisionsFromStore}>
                    {isLoadingDivisionsFromStore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Division'
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Create Division</h3>
                  </div>
                  <div>
                    <Label htmlFor="divisionName">Division Name *</Label>
                    <Input
                      id="divisionName"
                      value={newDivision.name}
                      onChange={(e) => safeSetNewDivision({ name: e.target.value })}
                      placeholder="e.g., Consumer Products"
                      onKeyPress={(e) => handleKeyPress(e, safeCreateDivision)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="divisionDescription">Description</Label>
                    <Textarea
                      id="divisionDescription"
                      value={newDivision.description}
                      onChange={(e) => safeSetNewDivision({ description: e.target.value })}
                      placeholder="Brief description of this division"
                      rows={3}
                      onKeyPress={(e) => handleKeyPress(e, safeCreateDivision)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="divisionIndustry">Industry</Label>
                    <Input
                      id="divisionIndustry"
                      value={newDivision.industry}
                      onChange={(e) => safeSetNewDivision({ industry: e.target.value })}
                      placeholder="e.g., Consumer Goods"
                      onKeyPress={(e) => handleKeyPress(e, safeCreateDivision)}
                    />
                  </div>
                  {(() => {
                    const isDivisionLevelWithoutColumn = orgStructure.importLevel === 'division' && 
                                                       orgStructure.divisionCsvType === 'withoutDivisionColumn' &&
                                                       orgStructure.hasMultipleClusters;
                    
                    // Don't show field mapping for division-level without column workflow
                    if (isDivisionLevelWithoutColumn) {
                      return null;
                    }
                    
                    return (
                      <div>
                        <Label htmlFor="divisionFieldMapping">Field Mapping *</Label>
                        <Input
                          id="divisionFieldMapping"
                          value={newDivision.fieldMapping || ''}
                          onChange={e => safeSetNewDivision({ fieldMapping: e.target.value })}
                          placeholder="e.g. CD1, D01, etc. (from CSV column)"
                          onKeyPress={(e) => handleKeyPress(e, safeCreateDivision)}
                        />
                      </div>
                    );
                  })()}
                  <Button onClick={safeCreateDivision} className="w-full" disabled={isLoadingDivisionsFromStore}>
                    {isLoadingDivisionsFromStore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Division'
                    )}
                  </Button>
                </>
              )}
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Divisions</h3>
              
              {/* Company Information */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                      <Landmark className="h-4 w-4" />
                      Company Name
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {divisions.length} division{divisions.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {isLoadingDivisionsFromStore ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600">Loading divisions...</p>
                    </div>
                  ) : divisions.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No divisions created yet</p>
                  ) : (
                    <div className="space-y-2">
                      {divisions
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((division, index) => {
                        // Use the isExisting flag from the combined array
                        const isExisting = division.isExisting;
                        const isSelected = editingDivision === index;
                        
                        return (
                          <div
                            key={`division-${index}`}
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
                              // If clicking the same division that's already being edited, force a re-render
                              if (editingDivision === index) {
                                safeSetEditingDivision(null);
                                setTimeout(() => {
                                  safeSetEditingDivision(index);
                                  safeSetEditDivisionForm({
                                    name: division.name,
                                    description: division.description || '',
                                    industry: division.industry || '',
                                    fieldMapping: division.fieldMapping || division.name || ''
                                  });
                                }, 0);
                              } else {
                                safeSetEditingDivision(index);
                                safeSetEditDivisionForm({
                                  name: division.name,
                                  description: division.description || '',
                                  industry: division.industry || '',
                                  fieldMapping: division.fieldMapping || division.name || ''
                                });
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
                                <Building2 className="h-3 w-3 text-blue-600" />
                                <p className={`font-medium ${
                                  isSelected 
                                    ? 'text-gray-900 dark:text-gray-100' 
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>{division.name}</p>
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
                              {division.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{division.description}</p>
                              )}
                              {division.industry && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Industry: {division.industry}</p>
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
                                    handleDeleteDivision(division);
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
                                    handleDeletePendingDivision(index);
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
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Delete Dialog */}
      {showDeleteDialog && divisionToDelete && (
        <EntityDeleteDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setDivisionToDelete(null);
          }}
          onConfirm={confirmDelete}
          entityName={divisionToDelete.name}
          entityType="division"
          entityId={divisionToDelete.id}
          onSuccess={() => {
            // deleteDivision already handles the refresh, no need to call loadDivisions again
          }}
        />
      )}
      
      {/* Inactive Entities Panel */}
      <InactiveEntitiesPanel
        isOpen={showInactivePanel}
        onClose={() => setShowInactivePanel(false)}
        onEntityRestored={() => {
          // Don't force reload - the Zustand store's restore function will handle the state update
          // This prevents losing user selections from previous steps
          // Don't close the panel - let user close it manually
        }}
        entityType="division"
      />
    </div>
  );
}; 