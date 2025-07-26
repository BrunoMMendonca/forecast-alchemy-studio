import React from 'react';

export interface CsvUploadResult {
  success: boolean;
  datasetId: number;
  sourceFilePath?: string;
  summary: {
    skuCount: number;
    dateRange: [string, string];
    totalPeriods: number;
    frequency?: string;
  };
  skuList: string[];
}

interface CsvImportWizardProps {
  onDataReady: (result: CsvUploadResult) => void;
  onConfirm: (result: CsvUploadResult) => Promise<void>;
  onFileNameChange?: (fileName: string) => void;
  lastImportFileName?: string | null;
  lastImportTime?: string | null;
  onAIFailure: (errorMessage: string) => void;
  onLoadExistingData?: (result: CsvUploadResult) => void;
  currentLoadedFile?: string;
  setLastLoadedDataset?: (dataset: any) => void;
  context?: 'forecast' | 'setup';
  onSetupDataReady?: (divisions: string[], clusters: string[], divisionClusterMap?: Record<string, string[]>, lifecyclePhases?: string[], isSingleCsvReplacement?: boolean, csvFileName?: string) => void;
  onProceedToNextStep?: () => Promise<void>;
  disableImport?: boolean;
}

export const CsvImportWizard: React.FC<CsvImportWizardProps> = ({
  context = 'forecast',
  onConfirm,
  onDataReady,
  onAIFailure,
  onSetupDataReady,
  disableImport = false
}) => {
  return (
    <div className="p-8 text-center">
      <h3 className="text-lg font-semibold mb-4">CSV Import Wizard</h3>
      <p className="text-gray-500 mb-4">Temporarily disabled during refactoring</p>
      <p className="text-sm text-gray-400">This feature will be restored in the next update</p>
      <div className="mt-4">
        <button
          onClick={() => {
            // Mock data for testing
            const mockResult: CsvUploadResult = {
              success: true,
              datasetId: 1,
              summary: {
                skuCount: 0,
                dateRange: ['2024-01-01', '2024-12-31'],
                totalPeriods: 12
              },
              skuList: []
            };
            onDataReady(mockResult);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Test Data Ready
        </button>
      </div>
    </div>
  );
};
