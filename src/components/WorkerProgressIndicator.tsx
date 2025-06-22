import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface WorkerProgressIndicatorProps {
  isWorking: boolean;
  progress: number;
  message: string;
  title?: string;
}

export const WorkerProgressIndicator: React.FC<WorkerProgressIndicatorProps> = ({
  isWorking,
  progress,
  message,
  title = 'Processing...'
}) => {
  if (!isWorking) return null;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-muted-foreground text-center">
            {message}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {Math.round(progress)}% complete
          </p>
        </div>
      </CardContent>
    </Card>
  );
}; 