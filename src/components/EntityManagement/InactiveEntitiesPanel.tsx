// InactiveEntitiesPanel - Temporarily simplified for refactoring
// This component will be fully migrated in a future update

import React from 'react';

interface InactiveEntitiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEntityRestored: () => void;
  entityType?: 'division' | 'cluster' | 'all';
}

export const InactiveEntitiesPanel: React.FC<InactiveEntitiesPanelProps> = ({
  isOpen,
  onClose,
  onEntityRestored,
  entityType = 'all'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Inactive Entities
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Inactive Entities Panel
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Temporarily disabled during refactoring
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            This feature will be restored in the next update
          </p>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}; 
 
 