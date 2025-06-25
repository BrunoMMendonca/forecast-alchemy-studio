import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, User, Bot, Edit3, RefreshCw, History } from 'lucide-react';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';

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
  onLoadDataset?: (dataset: any) => void;
  loadedDatasetFile?: string;
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
  onLoadDataset,
  loadedDatasetFile,
}) => {
  const { datasets, isLoading, error: detectError, refreshDatasets, setLastLoadedDataset } = useExistingDataDetection();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEditClick = (dataset: any) => {
    setEditingId(dataset.id);
    setEditName(dataset.name);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleEditSave = async (dataset: any) => {
    setSaving(true);
    await fetch('/api/save-dataset-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: `uploads/${dataset.filename}`, name: editName })
    });
    setSaving(false);
    setEditingId(null);
    setEditName('');
    refreshDatasets();
  };

  const handleLoadDataset = async (dataset: any) => {
    // Track this as the last loaded dataset
    setLastLoadedDataset(dataset);
    if (onLoadDataset) {
      onLoadDataset(dataset);
    }
  };

  return (
    <div className="space-y-8">
      {/* Continue with Existing Data */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Continue with Existing Data
          </div>
          <Button variant="ghost" size="sm" onClick={refreshDatasets} aria-label="Refresh" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
        {isLoading ? (
          <div className="text-slate-500 text-sm mb-4">Detecting datasets...</div>
        ) : detectError ? (
          <div className="text-red-600 text-sm mb-4">{detectError}</div>
        ) : (
          <div className="text-slate-500 text-sm mb-4">Found {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} with cleaned data</div>
        )}
        {/* Datasets container with scroll */}
        <div className="max-h-80 overflow-y-auto pr-2 pt-2 pb-2 space-y-4">
          {/* Sort so loaded dataset is first */}
          {[...datasets].sort((a, b) => {
            const loadedFileName = loadedDatasetFile?.split('/').pop();
            if (a.filename === loadedFileName) return -1;
            if (b.filename === loadedFileName) return 1;
            return 0;
          }).map(dataset => {
            const loadedFileName = loadedDatasetFile?.split('/').pop();
            const isLoaded = loadedFileName && dataset.filename === loadedFileName;
            return (
              <div
                key={dataset.id}
                className={`relative border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between bg-slate-50 transition-all duration-200
                  ${isLoaded ? 'border-2 border-blue-300 bg-blue-100 shadow-2xl ring-2 ring-blue-300' : 'border-slate-100'}
                `}
                style={isLoaded ? { boxShadow: '0 0 0 4px #3b82f6, 0 4px 24px 0 rgba(132, 173, 240, 0.1)' } : {}}
              >
                {isLoaded && <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-l" />}
                <div>
                  <div className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    {editingId === dataset.id ? (
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          handleEditSave(dataset);
                        }}
                        className="flex items-center"
                      >
                        <input
                          className="border rounded px-2 py-1 text-sm mr-2 w-96"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          disabled={saving}
                          autoFocus
                        />
                        <Button size="sm" className="mr-1" type="submit" disabled={saving || !editName.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
                      </form>
                    ) : (
                      <>
                        {dataset.name}
                        <Button size="sm" variant="ghost" className="ml-1 px-2 py-0.5 flex items-center gap-1" onClick={() => handleEditClick(dataset)} aria-label="Edit name" title="Edit name">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${dataset.type === 'AI Import' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                      {dataset.type === 'AI Import' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {dataset.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-1">Created: {new Date(dataset.timestamp).toLocaleDateString()}</div>
                  <div className="text-xs text-slate-600 mb-1">File: {dataset.filename}</div>
                  <div className="text-xs text-slate-600 mb-1">SKUs: {dataset.summary?.skuCount ?? 'N/A'}</div>
                  <div className="text-xs text-slate-600">Data Range: {dataset.summary?.dateRange ? `${dataset.summary.dateRange[0]} to ${dataset.summary.dateRange[1]}` : 'N/A'}</div>
                </div>
                <Button
                  className={`w-full md:w-40 h-10 mt-4 md:mt-0 md:ml-8 ${isLoaded ? 'bg-blue-800 text-white border-blue-800' : ''}`}
                  variant={isLoaded ? 'default' : 'default'}
                  disabled={isLoaded}
                  onClick={() => !isLoaded && handleLoadDataset(dataset)}
                >
                  {isLoaded ? 'Loaded' : 'Load Dataset'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 my-2" />

      {/* Upload Historical Sales Data */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Upload className="h-5 w-5 text-blue-600" />
          Upload Historical Sales Data
        </div>
        <div className="text-slate-500 text-sm mb-4">
          Upload a CSV file containing your historical sales data with columns: Date, SKU, Sales
        </div>
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
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>
    </div>
  );
}; 