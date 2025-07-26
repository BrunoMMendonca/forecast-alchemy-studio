import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { CheckCircle, ArrowRight, LogOut } from 'lucide-react';

interface SetupCompleteStepProps {
  company: any;
  pendingDivisions: any[];
  pendingClusters: any[];
  handleCompleteSetup: () => void;
}

export const SetupCompleteStep: React.FC<SetupCompleteStepProps> = ({
  company,
  pendingDivisions,
  pendingClusters,
  handleCompleteSetup
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Setup Complete
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Your organization is ready for forecasting
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <Badge variant="secondary" className="mb-2">
                {company?.name || 'Company'}
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Company configured
              </p>
            </div>
            <div className="text-center p-4">
              <Badge variant="secondary" className="mb-2">
                {pendingDivisions.length} Divisions
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Business units configured
              </p>
            </div>
            <div className="text-center p-4">
              <Badge variant="secondary" className="mb-2">
                {pendingClusters.length} Clusters
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Geographic regions set up
              </p>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <Button 
              onClick={handleCompleteSetup}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Save Configuration
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can always modify your organization structure later in the settings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 