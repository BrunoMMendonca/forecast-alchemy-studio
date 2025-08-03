import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle } from 'lucide-react';

interface DivisionCardsProps {
  store: any;
  selectedDivisionForMapping: string | null;
  onDivisionSelect: (division: any) => void;
  onClearDivisionSelection: () => void;
  isWithoutDivisionColumn?: boolean;
  showClearButton?: boolean;
}

export const DivisionCards: React.FC<DivisionCardsProps> = ({
  store,
  selectedDivisionForMapping,
  onDivisionSelect,
  onClearDivisionSelection,
  isWithoutDivisionColumn = false,
  showClearButton = true
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-medium mb-1">Division-Specific Field Mapping</p>
        {selectedDivisionForMapping && showClearButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearDivisionSelection}
            className="text-gray-600 hover:text-gray-800"
          >
            Clear Selection
          </Button>
        )}
      </div>
      <p className="text-gray-600 mb-4">
        {isWithoutDivisionColumn
          ? selectedDivisionForMapping
            ? `Selected division: "${selectedDivisionForMapping}". Upload a CSV file for this division. Each division can have its own CSV file.`
            : 'Select a division to upload a CSV file for that division. Each division can have its own CSV file.'
          : selectedDivisionForMapping
            ? `Selected division: "${selectedDivisionForMapping}". Configure its field mappings. Each division can have different column mappings for their CSV imports.`
            : 'Select a division to configure its field mappings. Each division can have different column mappings for their CSV imports.'
        }
      </p>
      
      {/* All Divisions (Existing + Pending) */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Existing Divisions */}
        {store.divisions?.filter((division: any) => {
          // Exclude inactive divisions
          if (division.is_active === false) return false;
          
          // Exclude divisions that are in deletedItems
          const isDeleted = store.orgStructure?.deletedItems?.divisions?.some(
            (deletedDiv: any) => deletedDiv.id === division.id || deletedDiv.name === division.name
          );
          if (isDeleted) return false;
          
          return true;
        }).map((division: any) => {
          // Check if division has CSV mapping
          const hasMapping = store.orgStructure?.csvImportData?.divisionSpecific?.[division.name];
          
          return (
            <div
              key={`existing-${division.id}`}
              onClick={() => onDivisionSelect(division)}
              className={`flex-shrink-0 p-3 border rounded-lg cursor-pointer transition-all min-w-[180px] max-w-[280px] flex-1 ${
                selectedDivisionForMapping === division.name
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-gray-900">{division.name}</span>
                </div>
                {hasMapping ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">{division.description || 'No description'}</p>
              <p className="text-xs text-gray-500">
                {hasMapping ? 'CSV mapping configured' : 'No CSV mapping'}
              </p>
            </div>
          );
        })}
        
        {/* Pending Divisions */}
        {store.orgStructure?.pendingDivisions?.filter((division: any) => {
          // Exclude existing divisions (they're shown above)
          if (division.isExisting) return false;
          
          // Exclude inactive divisions
          if (division.is_active === false) return false;
          
          // Exclude divisions that are in deletedItems
          const isDeleted = store.orgStructure?.deletedItems?.divisions?.some(
            (deletedDiv: any) => deletedDiv.name === division.name
          );
          if (isDeleted) return false;
          
          return true;
        }).map((division: any) => {
          // Check if division has CSV mapping
          const hasMapping = store.orgStructure?.csvImportData?.divisionSpecific?.[division.name];
          
          return (
            <div
              key={`pending-${division.name}`}
              onClick={() => onDivisionSelect(division)}
              className={`flex-shrink-0 p-3 border rounded-lg cursor-pointer transition-all min-w-[180px] max-w-[280px] flex-1 ${
                selectedDivisionForMapping === division.name
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-gray-900">{division.name}</span>
                </div>
                {hasMapping ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">{division.description || 'No description'}</p>
              <p className="text-xs text-gray-500">
                {hasMapping ? 'CSV mapping configured' : 'No CSV mapping'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 