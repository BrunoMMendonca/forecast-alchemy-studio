import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, RefreshCw, Upload, History } from 'lucide-react';
import { useExistingDataDetection } from '@/hooks/useExistingDataDetection';
import { CsvUploadResult } from '@/components/CsvImportWizard';

interface ExistingDataSelectorProps {
  onLoadExistingData: (result: CsvUploadResult) => void;
  onStartFresh: () => void;
}

export const ExistingDataSelector: React.FC<ExistingDataSelectorProps> = ({
  onLoadExistingData,
  onStartFresh
}) => {
  const { datasets, isLoading, error, loadLatestCleanedData, refreshDatasets, setLastLoadedDataset } = useExistingDataDetection();
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState('');

  const handleLoadDataset = async (dataset: any) => {
    const result = await loadLatestCleanedData(dataset);
    if (result) {
      // Track this as the last loaded dataset
      setLastLoadedDataset(dataset);
      onLoadExistingData(result);
    }
  };

  const handleEditName = (index: number, currentName: string) => {
    setEditingNameIndex(index);
    setNameInput(currentName);
  };

  const handleSaveName = async (dataset: any, index: number) => {
    // Save the name to the latest cleaned JSON file
    try {
      await fetch('/api/save-dataset-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: `uploads/${dataset.filename}`, name: nameInput })
      });
      setEditingNameIndex(null);
      refreshDatasets();
    } catch (err) {
      alert('Failed to save name');
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
            Detecting Existing Data...
          </CardTitle>
          <CardDescription>
            Scanning for previously imported and cleaned datasets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Looking for your previous work...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <RefreshCw className="h-5 w-5" />
            Error Detecting Data
          </CardTitle>
          <CardDescription>
            There was an issue detecting your existing data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={refreshDatasets} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={onStartFresh}>
                <Upload className="h-4 w-4 mr-2" />
                Start Fresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (datasets.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardContent>
          <Button onClick={onStartFresh} className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            Upload New Data
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Continue with Existing Data
            </CardTitle>
            <CardDescription>
              Found {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} with cleaned data
            </CardDescription>
          </div>
          <Button onClick={refreshDatasets} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {datasets.map((dataset, index) => (
          <div key={dataset.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {editingNameIndex === index ? (
                    <>
                      <input
                        className="border rounded px-2 py-1 text-sm mr-2"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        placeholder="Enter dataset name"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleSaveName(dataset, index)}>
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold text-gray-900">
                        {dataset.name}
                      </h3>
                      <Button size="sm" variant="ghost" onClick={() => handleEditName(index, dataset.name)}>
                        ✏️
                      </Button>
                    </>
                  )}
                  <Badge variant="secondary">
                    {dataset.type}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Created: {new Date(dataset.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    <span>File: {dataset.filename}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>SKUs: {dataset.summary?.skuCount ?? 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Data Range: {dataset.summary?.dateRange ? `${dataset.summary.dateRange[0]} to ${dataset.summary.dateRange[1]}` : 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleLoadDataset(dataset)}
                  size="sm"
                >
                  Load Dataset
                </Button>
              </div>
            </div>
          </div>
        ))}
        <div className="pt-4 border-t">
          <Button onClick={onStartFresh} variant="outline" className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            Upload New Data Instead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 