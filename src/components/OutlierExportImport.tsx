import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { getDefaultModels } from '@/utils/modelConfig';

interface OutlierExportImportProps {
  onExport: () => void;
  onImportClick: () => void;
  isExportDisabled: boolean;
}

export const OutlierExportImport: React.FC<OutlierExportImportProps> = ({
  onExport,
  onImportClick,
  isExportDisabled
}) => {
  const handleImportDataCleaning = useCallback((importedSKUs: string[]) => {
    console.log('handleImportDataCleaning called with:', importedSKUs);
    const allModels = getDefaultModels();
    console.log('Models used for queueing:', allModels);
    // ...rest of the code
    console.log('Jobs to add:', jobs);
  }, []);

  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-3">Data Cleaning Export/Import</h3>
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          onClick={onImportClick}
        >
          <Download className="h-4 w-4 mr-2" />
          Import Cleaning Data
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onExport}
          disabled={isExportDisabled}
        >
          <Upload className="h-4 w-4 mr-2" />
          Export Cleaning Data
        </Button>
        
        <div className="text-sm text-slate-600">
          Import previously saved cleaning data or export your cleaning changes
        </div>
      </div>
    </div>
  );
};
