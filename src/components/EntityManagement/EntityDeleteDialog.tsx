import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Loader2, AlertTriangle, Trash2, Archive, Database } from 'lucide-react';
import { toast } from 'sonner';

interface EntityUsage {
  hasData: boolean;
  datasetCount: number;
  clusterCount?: number;
  sopCount: number;
  totalCount: number;
}

interface EntityDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (forceHardDelete?: boolean) => Promise<{ success: boolean; method: 'soft' | 'hard'; error?: string }>;
  entityName: string;
  entityType: 'division' | 'cluster';
  entityId: number;
  usageData?: EntityUsage;
  onSuccess?: () => void;
}

export const EntityDeleteDialog: React.FC<EntityDeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entityName,
  entityType,
  entityId,
  usageData,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [forceHardDelete, setForceHardDelete] = useState(false);
  const [usage, setUsage] = useState<EntityUsage | null>(usageData || null);

  // Fetch usage data if not provided
  useEffect(() => {
    if (isOpen && !usageData && entityId) {
      fetchUsageData();
    }
  }, [isOpen, entityId, usageData]);

  const fetchUsageData = async () => {
    try {
      const response = await fetch(`/api/${entityType}s/${entityId}/usage`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
      }
    } catch (error) {
      console.error(`Error fetching ${entityType} usage:`, error);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const result = await onConfirm(forceHardDelete);
      
      if (result.success) {
        toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} deleted successfully (${result.method} delete)`);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || `Failed to delete ${entityType}`);
      }
    } catch (error) {
      console.error(`Error deleting ${entityType}:`, error);
      toast.error(`Failed to delete ${entityType}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getUsageDescription = () => {
    if (!usage) return null;
    
    const items = [];
    if (usage.datasetCount > 0) {
      items.push(`${usage.datasetCount} dataset${usage.datasetCount > 1 ? 's' : ''}`);
    }
    if (usage.clusterCount && usage.clusterCount > 0) {
      items.push(`${usage.clusterCount} cluster${usage.clusterCount > 1 ? 's' : ''}`);
    }
    if (usage.sopCount > 0) {
      items.push(`${usage.sopCount} S&OP cycle${usage.sopCount > 1 ? 's' : ''}`);
    }
    
    return items.join(', ');
  };

  const canHardDelete = usage?.hasData && !forceHardDelete;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{entityName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Usage Information */}
          {usage && (
            <Alert className={usage.hasData ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
              <AlertTriangle className={`h-4 w-4 ${usage.hasData ? 'text-orange-600' : 'text-green-600'}`} />
              <AlertDescription>
                {usage.hasData ? (
                  <div className="space-y-2">
                    <p className="font-medium text-orange-800">
                      This {entityType} has associated data:
                    </p>
                    <div className="text-sm text-orange-700">
                      {getUsageDescription()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                        {usage.totalCount} total records
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-green-800">
                    <p className="font-medium">No associated data found</p>
                    <p className="text-sm">This {entityType} can be safely deleted.</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Delete Options */}
          {usage?.hasData && (
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <input
                  type="radio"
                  id="soft-delete"
                  name="delete-type"
                  checked={!forceHardDelete}
                  onChange={() => setForceHardDelete(false)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="soft-delete" className="font-medium text-gray-900">
                    Soft Delete (Recommended)
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Keep the {entityType} and its data for historical purposes. 
                    It will be hidden from normal operations but can be restored later.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <input
                  type="radio"
                  id="hard-delete"
                  name="delete-type"
                  checked={forceHardDelete}
                  onChange={() => setForceHardDelete(true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="hard-delete" className="font-medium text-red-900">
                    Hard Delete (Permanent)
                  </label>
                  <p className="text-sm text-red-600 mt-1">
                    Permanently delete the {entityType} and all associated data. 
                    This action cannot be undone.
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <Database className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-500">
                      {usage.totalCount} records will be permanently deleted
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warning for hard delete */}
          {forceHardDelete && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Warning:</strong> This will permanently delete all associated data. 
                This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={forceHardDelete ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : forceHardDelete ? (
              <Trash2 className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {isLoading 
              ? 'Deleting...' 
              : forceHardDelete 
                ? 'Delete Permanently' 
                : 'Soft Delete'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 
 
 
 
 
 
 
 
 
 