
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';

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
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-3">Data Cleaning Export/Import</h3>
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          onClick={onExport}
          disabled={isExportDisabled}
        >
          <Download className="h-4 w-4 mr-2" />
          Export Cleaning Data
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onImportClick}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import Cleaning Data
        </Button>
        
        <div className="text-sm text-slate-600">
          Export your cleaning changes or import previously saved cleaning data
        </div>
      </div>
    </div>
  );
};
