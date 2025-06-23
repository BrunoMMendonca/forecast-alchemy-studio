import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface UploadStepProps {
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
  isDragging: boolean;
  error: string | null;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDropAreaClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({
  lastImportFileName,
  lastImportTime,
  isDragging,
  error,
  onDrop,
  onDragOver,
  onDragLeave,
  onDropAreaClick,
  onFileChange,
}) => {
  return (
    <div className="space-y-4">
      {lastImportFileName && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-blue-800 mb-1">A file has already been loaded.</div>
            <div className="text-sm text-blue-700">File: <span className="font-mono">{lastImportFileName}</span></div>
            {lastImportTime && <div className="text-xs text-blue-600">Imported on: {lastImportTime}</div>}
            <div className="text-xs text-blue-600 mt-1">You can continue with your current file or upload a new one below.</div>
          </div>
          <Button
            className="mt-4 md:mt-0 md:ml-8"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('goToStep', { detail: { step: 1 } });
                window.dispatchEvent(event);
              }
            }}
            variant="default"
          >
            Continue with Current File
          </Button>
        </div>
      )}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onDropAreaClick}
      >
        <Upload className={`h-12 w-12 mx-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
        <div>
          <h3 className="text-lg font-semibold text-slate-700">Drop your CSV file here</h3>
          <p className="text-slate-500">or click to browse files</p>
        </div>
      </div>
      <input
        id="csv-upload-input"
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        className="hidden"
      />
      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}; 