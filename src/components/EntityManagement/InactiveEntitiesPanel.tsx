import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, RotateCcw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSetupWizardStore } from '@/store/setupWizardStoreRefactored';

interface InactiveEntity {
  id: number;
  name: string;
  description: string;
  deleted_at: string;
  deleted_by: number;
  deleted_by_username?: string;
  division_name?: string; // For clusters
  industry?: string; // For divisions
  country_code?: string; // For clusters
  region?: string; // For clusters
  isExisting?: boolean; // New field to indicate source
  originalPendingIndex?: number; // For unique identification of pending clusters
}

interface InactiveEntitiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEntityRestored: () => void;
  entityType?: 'division' | 'cluster' | 'all'; // New prop to filter entities
}

export const InactiveEntitiesPanel: React.FC<InactiveEntitiesPanelProps> = ({
  isOpen,
  onClose,
  onEntityRestored,
  entityType = 'all' // Default to showing all entities
}) => {
  const [inactiveDivisions, setInactiveDivisions] = useState<InactiveEntity[]>([]);
  const [inactiveClusters, setInactiveClusters] = useState<InactiveEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<number | null>(null);
  
  // Get store functions and state
  const { 
    restoreDivision, 
    restoreCluster,
    restorePendingDivision,
    restorePendingCluster,
    orgStructure
  } = useSetupWizardStore();

  useEffect(() => {
    if (isOpen) {
      loadInactiveEntities();
    }
  }, [isOpen]);

  // Listen for custom events when entities are deleted or restored
  useEffect(() => {
    const handleInactiveEntitiesChanged = (event: CustomEvent) => {
      // Only refresh if the panel is open
      if (isOpen) {
        console.log('🔄 Inactive entities changed, refreshing list:', event.detail);
        loadInactiveEntities();
      }
    };

    // Add event listener
    window.addEventListener('inactiveEntitiesChanged', handleInactiveEntitiesChanged as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('inactiveEntitiesChanged', handleInactiveEntitiesChanged as EventListener);
    };
  }, [isOpen]);

  // Add effect to refresh when deletedItems change
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 InactiveEntitiesPanel: deletedItems changed:', {
        deletedDivisions: orgStructure.deletedItems?.divisions?.length || 0,
        deletedClusters: orgStructure.deletedItems?.clusters?.length || 0,
        deletedDivisionsData: orgStructure.deletedItems?.divisions,
        deletedClustersData: orgStructure.deletedItems?.clusters
      });
      loadInactiveEntities();
    }
  }, [isOpen, orgStructure.deletedItems?.divisions?.length, orgStructure.deletedItems?.clusters?.length]);

  useEffect(() => {
    if (isOpen) {
      loadInactiveEntities();
    }
  }, [isOpen]);

  const loadInactiveEntities = async () => {
    setIsLoading(true);
    try {
      // For setup wizard context, we only use Zustand state (no database calls)
      // The deletedItems are already populated by the delete functions
      console.log('🔄 Loading inactive entities from Zustand store:', {
        deletedDivisions: orgStructure.deletedItems?.divisions?.length || 0,
        deletedClusters: orgStructure.deletedItems?.clusters?.length || 0
      });
      
      // Use the deleted items from the store and map them to InactiveEntity format
      const mappedDivisions = (orgStructure.deletedItems?.divisions || []).map(division => ({
        ...division,
        deleted_at: new Date().toISOString(), // Use current time as deleted_at
        deleted_by: 1, // Default user ID
        deleted_by_username: 'Current User'
      }));
      
      const mappedClusters = (orgStructure.deletedItems?.clusters || []).map(cluster => ({
        ...cluster,
        deleted_at: new Date().toISOString(), // Use current time as deleted_at
        deleted_by: 1, // Default user ID
        deleted_by_username: 'Current User'
      }));
      
      setInactiveDivisions(mappedDivisions);
      setInactiveClusters(mappedClusters);
      
    } catch (error) {
      console.error('Error loading inactive entities:', error);
      toast.error('Failed to load inactive entities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (entityId: number, entityType: 'division' | 'cluster', clusterName?: string, divisionName?: string) => {
    setIsRestoring(entityId);
    try {
      let result;
      
      // For setup wizard context, we only use Zustand state (no database calls)
      if (entityType === 'division') {
        result = restorePendingDivision(entityId);
      } else {
        result = restorePendingCluster(entityId, clusterName, divisionName);
      }
      
      if (result.success) {
        toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} restored successfully`);
        onEntityRestored();
        
        // Use setTimeout to check the count after the state has been updated
        setTimeout(() => {
          const currentState = useSetupWizardStore.getState();
          const remainingDivisions = currentState.orgStructure.deletedItems?.divisions?.length || 0;
          const remainingClusters = currentState.orgStructure.deletedItems?.clusters?.length || 0;
          
          if (entityType === 'division' && remainingDivisions === 0) {
            // Last division restored, close the panel
            onClose();
          } else if (entityType === 'cluster' && remainingClusters === 0) {
            // Last cluster restored, close the panel
            onClose();
          }
        }, 0);
        // No need to reload since we're using Zustand state
      } else {
        toast.error(result.error || `Failed to restore ${entityType}`);
      }
    } catch (error) {
      console.error(`Error restoring ${entityType}:`, error);
      toast.error(`Failed to restore ${entityType}`);
    } finally {
      setIsRestoring(null);
    }
  };

  const renderEntityCard = (entity: InactiveEntity, entityType: 'division' | 'cluster', uniqueKey?: string) => (
    <Card key={uniqueKey || `${entityType}-${entity.id}-${entity.name}`} className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900">{entity.name}</h4>
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                Pending
              </Badge>
              {/* Show source indicator */}
              {entity.isExisting && (
                <Badge variant="outline" className="text-xs text-gray-600 border-gray-600">
                  From DB
                </Badge>
              )}
              {!entity.isExisting && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  From CSV
                </Badge>
              )}
            </div>
            
            {entity.description && (
              <p className="text-sm text-gray-600 mb-2">{entity.description}</p>
            )}
            
            {/* Entity-specific details */}
            {entityType === 'division' && entity.industry && (
              <p className="text-sm text-gray-500 mb-2">
                Industry: {entity.industry}
              </p>
            )}
            
            {entityType === 'cluster' && (
              <div className="text-sm text-gray-500 mb-2 space-y-1">
                {entity.division_name && (
                  <p>Division: {entity.division_name}</p>
                )}
                {(entity.country_code || entity.region) && (
                  <p>Location: {[entity.country_code, entity.region].filter(Boolean).join(', ')}</p>
                )}
              </div>
            )}
            
            {/* Restore button */}
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                onClick={() => handleRestore(entity.id, entityType, entity.name, entity.division_name)}
                disabled={isRestoring === entity.id}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRestoring === entity.id ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1 text-blue-100" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1 text-blue-100" />
                    Restore
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderDivisionWithClusters = (division: any, clusters: any[]) => (
    <Card key={`division-${division.id || division.originalPendingIndex}`} className="border-gray-300 bg-gray-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900">Division: "{division.name}"</h4>
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                Pending
              </Badge>
              {division.isExisting && (
                <Badge variant="outline" className="text-xs text-gray-600 border-gray-600">
                  From DB
                </Badge>
              )}
              {!division.isExisting && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  From CSV
                </Badge>
              )}
            </div>
            
            {division.description && (
              <p className="text-sm text-gray-600 mb-2">{division.description}</p>
            )}
            
            {division.industry && (
              <p className="text-sm text-gray-500 mb-2">
                Industry: {division.industry}
              </p>
            )}
            
            {/* Associated Clusters Section */}
            {clusters.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  Associated Clusters ({clusters.length})
                </h5>
                <div className="space-y-3">
                  {clusters.map((cluster, index) => (
                    <Card key={`cluster-${cluster.id || cluster.originalPendingIndex || index}-${cluster.divisionName || division.name}-${index}`} className="border-blue-200 bg-blue-50 ml-4">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h6 className="font-medium text-gray-900">Cluster: "{cluster.name}"</h6>
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                                Pending
                              </Badge>
                              {cluster.isExisting && (
                                <Badge variant="outline" className="text-xs text-gray-600 border-gray-600">
                                  From DB
                                </Badge>
                              )}
                              {!cluster.isExisting && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                  From CSV
                                </Badge>
                              )}
                              {cluster.requiresParentRestore && (
                                <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                                  Needs Parent
                                </Badge>
                              )}
                            </div>
                            
                            {cluster.description && (
                              <p className="text-sm text-gray-600 mb-2">{cluster.description}</p>
                            )}
                            
                            <div className="text-sm text-gray-500 mb-2 space-y-1">
                              <p>Division: {cluster.divisionName || division.name}</p>
                              {(cluster.country_code || cluster.region) && (
                                <p>Location: {[cluster.country_code, cluster.region].filter(Boolean).join(', ')}</p>
                              )}
                            </div>
                            
                            {/* Restore button for cluster */}
                            <div className="flex justify-end mt-3">
                              <Button
                                size="sm"
                                onClick={() => handleRestore(cluster.id, 'cluster', cluster.name, cluster.divisionName || division.name)}
                                disabled={isRestoring === cluster.id || cluster.requiresParentRestore}
                                className={`${cluster.requiresParentRestore ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                              >
                                {isRestoring === cluster.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1 text-blue-100" />
                                    Restoring...
                                  </>
                                ) : cluster.requiresParentRestore ? (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1 text-gray-100" />
                                    Restore Division First
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1 text-blue-100" />
                                    Restore
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Restore button for division */}
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                onClick={() => handleRestore(division.id, 'division')}
                disabled={isRestoring === division.id}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRestoring === division.id ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1 text-blue-100" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1 text-blue-100" />
                    Restore Division
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStandaloneDivisionWithClusters = (divisionName: string, clusters: any[]) => (
    <Card key={`standalone-division-${divisionName}`} className="border-gray-300 bg-gray-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900">Division: "{divisionName}"</h4>
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-600">
                Active
              </Badge>
            </div>
            
            <p className="text-sm text-gray-500 mb-2">
              Division exists in the system but has inactive clusters
            </p>
            
            {/* Associated Clusters Section */}
            {clusters.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  Associated Clusters ({clusters.length})
                </h5>
                <div className="space-y-3">
                  {clusters.map((cluster, index) => (
                    <Card key={`cluster-${cluster.id || cluster.originalPendingIndex || index}-${cluster.divisionName || divisionName}-${index}`} className="border-blue-200 bg-blue-50 ml-4">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h6 className="font-medium text-gray-900">Cluster: "{cluster.name}"</h6>
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                                Pending
                              </Badge>
                              {cluster.isExisting && (
                                <Badge variant="outline" className="text-xs text-gray-600 border-gray-600">
                                  From DB
                                </Badge>
                              )}
                              {!cluster.isExisting && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                  From CSV
                                </Badge>
                              )}
                            </div>
                            
                            {cluster.description && (
                              <p className="text-sm text-gray-600 mb-2">{cluster.description}</p>
                            )}
                            
                            <div className="text-sm text-gray-500 mb-2 space-y-1">
                              <p>Division: {cluster.divisionName || divisionName}</p>
                              {(cluster.country_code || cluster.region) && (
                                <p>Location: {[cluster.country_code, cluster.region].filter(Boolean).join(', ')}</p>
                              )}
                            </div>
                            
                            {/* Restore button for cluster */}
                            <div className="flex justify-end mt-3">
                              <Button
                                size="sm"
                                onClick={() => handleRestore(cluster.id, 'cluster', cluster.name, cluster.divisionName || divisionName)}
                                disabled={isRestoring === cluster.id}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                {isRestoring === cluster.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1 text-blue-100" />
                                    Restoring...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1 text-blue-100" />
                                    Restore
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isOpen ? '' : 'hidden'}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Inactive Entities
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading inactive entities...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group all clusters by their division name */}
              {(() => {
                const divisions = orgStructure.deletedItems?.divisions || [];
                const clusters = orgStructure.deletedItems?.clusters || [];
                
                console.log('🔄 Rendering inactive entities:', {
                  divisions: divisions.map(d => ({ name: d.name, id: d.id })),
                  clusters: clusters.map(c => ({ name: c.name, divisionName: c.divisionName, divisionId: c.division_id }))
                });
                
                // Group all clusters by division name
                const clustersByDivision = clusters.reduce((acc, cluster) => {
                  const divisionName = cluster.divisionName || 'Unknown';
                  if (!acc[divisionName]) {
                    acc[divisionName] = [];
                  }
                  acc[divisionName].push(cluster);
                  return acc;
                }, {} as Record<string, any[]>);
                
                console.log('🔄 Clusters by division:', clustersByDivision);
                
                // Get all unique division names from clusters
                const allDivisionNames = Object.keys(clustersByDivision);
                
                console.log('🔄 All division names from clusters:', allDivisionNames);
                
                return allDivisionNames.map(divisionName => {
                  const associatedClusters = clustersByDivision[divisionName];
                  
                  console.log('🔄 Processing division:', divisionName, 'with clusters:', associatedClusters);
                  
                  // Check if this division exists in deleted items
                  const deletedDivision = divisions.find(d => d.name === divisionName);
                  
                  console.log('🔄 Found deleted division for', divisionName, ':', deletedDivision);
                  
                  if (deletedDivision) {
                    // Render division with its associated clusters
                    return renderDivisionWithClusters(deletedDivision, associatedClusters);
                  } else {
                    // Render a virtual division card for standalone clusters
                    return renderStandaloneDivisionWithClusters(divisionName, associatedClusters);
                  }
                });
              })()}
              
              {/* Also render standalone divisions (divisions without clusters) */}
              {(() => {
                const divisions = orgStructure.deletedItems?.divisions || [];
                const clusters = orgStructure.deletedItems?.clusters || [];
                
                // Get all division names that have clusters
                const divisionNamesWithClusters = new Set(
                  clusters.map(cluster => cluster.divisionName || 'Unknown')
                );
                
                console.log('🔄 Division names with clusters:', Array.from(divisionNamesWithClusters));
                
                // Find divisions that don't have clusters
                const standaloneDivisions = divisions.filter(division => 
                  !divisionNamesWithClusters.has(division.name)
                );
                
                console.log('🔄 Standalone divisions:', standaloneDivisions);
                
                return standaloneDivisions.map(division => {
                  console.log('🔄 Rendering standalone division:', division.name);
                  return renderDivisionWithClusters(division, []);
                });
              })()}
              
              {/* No inactive entities */}
              {(() => {
                const divisions = orgStructure.deletedItems?.divisions || [];
                const clusters = orgStructure.deletedItems?.clusters || [];
                const totalEntities = divisions.length + clusters.length;
                
                return totalEntities === 0;
              })() && (
                <div className="text-center py-8 text-gray-500">
                  <p>No inactive entities found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 
 
 