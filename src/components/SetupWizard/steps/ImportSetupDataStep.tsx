import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Progress } from '../../ui/progress';
import { Upload, Loader2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface ImportSetupDataStepProps {
  orgStructure: any;
  pendingDivisions: any[];
  pendingClusters: any[];
  setCurrentStep: (step: number) => void;
  getStepIndexByTitle: (title: string) => number;
}

export const ImportSetupDataStep: React.FC<ImportSetupDataStepProps> = ({
  orgStructure,
  pendingDivisions,
  pendingClusters,
  setCurrentStep,
  getStepIndexByTitle
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-blue-600" />
            Import Setup Data
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Import your setup CSV as the first dataset for forecasting
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Setup Data Available</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
              We found CSV data from your setup process that can be imported as your first dataset.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                <Badge variant="secondary" className="mb-2">
                  {orgStructure.csvImportData?.csvFileName || 'CSV File'}
                </Badge>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Original file
                </p>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                <Badge variant="secondary" className="mb-2">
                  {orgStructure.csvImportData?.headers?.length || 0} Columns
                </Badge>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Data structure
                </p>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                <Badge variant="secondary" className="mb-2">
                  {orgStructure.csvImportData?.data?.length || 0} Rows
                </Badge>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Data records
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => {
                  // Navigate to forecast page with setup data
                  window.location.href = '/forecast?setupData=true';
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import as First Dataset
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  // Skip to setup complete
                  setCurrentStep(getStepIndexByTitle('Setup Complete'));
                }}
                className="flex items-center justify-center"
              >
                Skip for Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Note:</strong> You can always import data later from the forecast page.
            </p>
            <p>
              The setup data includes your organizational structure and can serve as a template for future imports.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 