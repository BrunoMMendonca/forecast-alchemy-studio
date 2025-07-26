import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Zap, Eye, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';

interface QueueStatusDisplayProps {
  onOpenQueuePopup?: () => void;
}

export const QueueStatusDisplay: React.FC<QueueStatusDisplayProps> = ({
  onOpenQueuePopup,
}) => {
  const { summary, isLoading, error } = useOptimizationStatusContext();

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 border-gray-200">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
          <span className="font-medium text-gray-800">Loading queue status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 bg-red-50 border-red-200">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-600" />
          <span className="font-medium text-red-800">Error loading queue status</span>
        </div>
      </div>
    );
  }

  const shouldShow = summary.isOptimizing || summary.total > 0;

  if (!shouldShow) {
    return null;
  }

  const getStatusInfo = () => {
    if (summary.isOptimizing) {
      return {
        icon: <Zap className="h-4 w-4 text-blue-600" />,
        text: `Optimizing ${summary.running + summary.pending} SKUs`,
        badge: `${summary.completed + summary.failed}/${summary.total - summary.cancelled}`,
        className: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        badgeVariant: 'secondary' as const,
      };
    } else if (summary.completed > 0) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        text: `${summary.completed} optimizations completed`,
        badge: summary.failed > 0 ? `${summary.failed} failed` : 'All done',
        className: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeVariant: summary.failed > 0 ? 'destructive' as const : 'default' as const,
      };
    } else if (summary.failed > 0) {
      return {
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        text: `${summary.failed} optimizations failed`,
        badge: 'Failed',
        className: 'bg-red-50 border-red-200',
        textColor: 'text-red-800',
        badgeVariant: 'destructive' as const,
      };
    } else {
      return {
        icon: <Clock className="h-5 w-5 text-amber-600" />,
        text: `${summary.total} optimizations queued`,
        badge: 'Pending',
        className: 'bg-amber-50 border-amber-200',
        textColor: 'text-amber-800',
        badgeVariant: 'outline' as const,
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`border rounded-lg p-4 ${statusInfo.className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {summary.isOptimizing && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          )}
          {statusInfo.icon}
          <span className={`font-medium ${statusInfo.textColor}`}>
            {statusInfo.text}
              </span>
          <Badge 
            variant={statusInfo.badgeVariant} 
            className={`text-xs ${
              statusInfo.badgeVariant === 'outline' 
                ? 'border-amber-300 text-amber-700' 
                : ''
            }`}
          >
            {statusInfo.badge}
              </Badge>
          
          {/* Progress bar for active optimizations */}
          {summary.isOptimizing && summary.total > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <div className="w-24 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${summary.progress}%` }}
                />
              </div>
              <span className="text-xs text-blue-600 font-medium">
                {summary.progress}%
              </span>
            </div>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenQueuePopup}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          View Details
        </Button>
      </div>
    </div>
  );
};
