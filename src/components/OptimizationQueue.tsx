import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  XCircle,
  CheckCircle,
  Loader2,
  Clock,
  Ban,
  Trash2,
  AlertTriangle,
  Play,
  Pause,
  Square,
  Settings,
  Database,
  FileText,
  SkipForward,
  Info,
  Merge,
  Circle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOptimizationStatusContext } from '@/contexts/OptimizationStatusContext';
import { OptimizationStatus, SKUGroup, OptimizationBatch } from '@/hooks/useOptimizationStatus';
import { useToast } from './ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Helper function to format time
const formatTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return format(date, 'HH:mm:ss');
  } catch {
    return 'N/A';
  }
};

// Helper function to format date
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch {
    return 'N/A';
  }
};

// Helper function to get priority info
const getPriorityInfo = (priority: number) => {
  switch (priority) {
    case 1:
      return { text: 'High', className: 'bg-red-100 text-red-800 border-red-200' };
    case 2:
      return { text: 'Medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    case 3:
      return { text: 'Low', className: 'bg-green-100 text-green-800 border-green-200' };
    default:
      return { text: 'Normal', className: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

// Helper function to get reason display name
const getReasonDisplayName = (reason: string) => {
  const reasonMap: Record<string, string> = {
    'manual_trigger': 'Manual Trigger',
    'csv_upload': 'CSV Upload',
    'data_cleaning': 'Data Cleaning',
    'csv_upload_data_cleaning': 'Data Cleaning',
    'manual_edit_data_cleaning': 'Data Cleaning',
    'ai_optimization': 'AI Optimization',
    'grid_optimization': 'Grid Optimization',
    'batch_optimization': 'Batch Optimization'
  };
  return reasonMap[reason] || reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to get status display text
const getStatusDisplayText = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'skipped':
      return 'Merged with existing optimization';
    default:
      return status;
  }
};

// Status icon component
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-gray-500" />;
    case 'skipped':
      return <Merge className="h-4 w-4 text-orange-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};

// Batch card component (replacing SKUGroupCard)
const BatchCard = ({ 
  batch, 
  onCancel, 
  onPause, 
  onResume 
}: { 
  batch: OptimizationBatch;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) => {
  const isActive = batch.isOptimizing;

  return (
    <Card className={cn(
      "transition-all duration-200",
      isActive ? "border-blue-200 bg-blue-50/50" : "border-gray-200"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isActive ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <Database className="h-5 w-5 text-gray-500" />
              )}
              <div>
                <CardTitle className="text-lg font-semibold">
                  {batch.sku}
                  {batch.skuDescription && (
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      - {batch.skuDescription}
                    </span>
                  )}
                </CardTitle>
                <div className="text-sm text-gray-600">
                  {batch.batchTimestamp ? (
                    <span className="font-medium">
                      {formatDate(new Date(batch.batchTimestamp).toISOString())} at {formatTime(new Date(batch.batchTimestamp).toISOString())}
                    </span>
                  ) : (
                    <span className="text-gray-500">No timestamp available</span>
                  )}
                </div>
              </div>
            </div>
            <Badge className={cn('font-semibold', getPriorityInfo(batch.priority).className)}>
              {getPriorityInfo(batch.priority).text}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-600">{batch.progress}%</span>
          </div>
          <Progress value={batch.progress} className="h-2" />
        </div>

        {/* Job status summary */}
        <div className="grid grid-cols-6 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{batch.pendingJobs}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{batch.runningJobs}</div>
            <div className="text-xs text-gray-500">Running</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{batch.completedJobs}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{batch.failedJobs}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div className="text-center">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-orange-600 flex items-center gap-1">
                <Merge className="h-4 w-4 text-orange-500" />
                {batch.skippedJobs || 0}
              </span>
              <span className="text-xs text-gray-500">Merged</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{batch.totalJobs}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>

        {/* Optimizations table */}
        {Object.values(batch.optimizations).length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Model</TableHead>
                  <TableHead className="w-32">Optimization Reason</TableHead>
                  <TableHead className="w-24">Progress</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(batch.optimizations).map((optimization) => (
                  <TableRow key={optimization.optimizationId}>
                    <TableCell>
                      <div className="text-sm font-medium">{optimization.modelDisplayName}</div>
                      <div className="text-xs text-gray-500">{optimization.modelShortName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{optimization.methodDisplayName}</div>
                      <div className="text-xs text-gray-500">{getReasonDisplayName(optimization.reason)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={optimization.progress} className="h-2 w-16" />
                        <span className="text-sm text-gray-600">{optimization.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={optimization.status} />
                        <span className="text-sm capitalize">{getStatusDisplayText(optimization.status)}</span>
                        {optimization.status === 'skipped' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  This optimization was merged with an existing one. 
                                  It will use the latest data when the optimization runs.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface OptimizationQueueProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  datasetId?: number;
}

export const OptimizationQueue: React.FC<OptimizationQueueProps> = ({
  isOpen,
  onOpenChange,
  datasetId,
}) => {
  const { toast } = useToast();
  const {
    skuGroups,
    activeOptimizations,
    completedOptimizations,
    failedOptimizations,
    skippedOptimizations,
    summary,
    isLoading,
    error,
    cancelOptimization,
    pauseOptimization,
    resumeOptimization,
    fetchOptimizations,
  } = useOptimizationStatusContext();

  const [activeTab, setActiveTab] = useState('active');
  const [showSkippedBanner, setShowSkippedBanner] = useState(true); // Show banner by default
  const [showMergedInfo, setShowMergedInfo] = useState(false); // Control merged info visibility

  const handleClearCompleted = async () => {
    try {
      const response = await fetch('/api/jobs/clear-completed', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          datasetId: datasetId 
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear completed jobs.');
      }
      toast({ title: 'Success', description: 'Cleared completed optimizations.' });
      // Refresh the optimization status
      await fetchOptimizations();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    }
  };

  const handleResetAll = async () => {
    if (window.confirm('Are you sure you want to reset all optimizations? This action cannot be undone.')) {
      try {
        const response = await fetch('/api/jobs/reset', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            datasetId: datasetId 
          })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to reset optimizations.');
        }
        toast({ title: 'Success', description: 'All optimizations have been reset.' });
        // Refresh the optimization status
        await fetchOptimizations();
        // Close the dialog
        onOpenChange(false);
      } catch (error) {
        toast({ 
          title: 'Error', 
          description: error instanceof Error ? error.message : 'Unknown error', 
          variant: 'destructive' 
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh]" forceMount>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Optimization Queue
          </DialogTitle>
        </DialogHeader>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2">Loading optimizations...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-500">
              <AlertTriangle className="h-8 w-8 mr-2" />
              <span>Error loading optimizations: {error}</span>
            </div>
          ) : (
            <>
              {/* Skipped Jobs Banner 
              {showSkippedBanner && summary.skipped > 0 && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Merge className="h-5 w-5 text-orange-600" />
                      <div>
                        <div className="text-sm font-medium text-orange-800">
                          {summary.skipped} job(s) were merged
                        </div>
                        <div className="text-xs text-orange-700">
                          These jobs were merged with existing optimizations to avoid duplicates.
                          Check the "Merged" tab for details.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowSkippedBanner(false)}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}*/}
              {/* Summary stats */}
              <div className="grid grid-cols-5 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600">Active</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.pending + summary.running}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {summary.completed}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Merge className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-gray-600">Merged</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {summary.skipped || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-gray-600">Failed</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                      {summary.failed}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Total</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-600">
                      {summary.total}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Overall progress */}
              {summary.total > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm text-gray-600">{summary.progress}%</span>
                  </div>
                  <Progress value={summary.progress} className="h-3" />
                </div>
              )}

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4" />
                    Active ({summary.pending + summary.running})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Completed ({summary.completed})
                  </TabsTrigger>
                  <TabsTrigger value="skipped" className="flex items-center gap-2">
                    <Merge className="h-4 w-4" />
                    Merged ({summary.skipped})
                  </TabsTrigger>
                  <TabsTrigger value="failed" className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Failed ({summary.failed})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {activeOptimizations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No active optimizations
                      </div>
                    ) : (
                      activeOptimizations.map((batch, index) => (
                        <BatchCard
                          key={`active-${batch.batchId}-${index}`}
                          batch={batch}
                          onCancel={cancelOptimization}
                          onPause={pauseOptimization}
                          onResume={resumeOptimization}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="completed" className="mt-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {completedOptimizations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No completed optimizations
                      </div>
                    ) : (
                      completedOptimizations.map((batch, index) => (
                        <BatchCard
                          key={`completed-${batch.batchId}-${index}`}
                          batch={batch}
                          onCancel={cancelOptimization}
                          onPause={pauseOptimization}
                          onResume={resumeOptimization}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="skipped" className="mt-4">
                  <div className="mb-4">
                    {!showMergedInfo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMergedInfo(true)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Info className="h-4 w-4 mr-2" />
                        Learn more about merged optimizations
                      </Button>
                    )}
                    
                    {showMergedInfo && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMergedInfo(false)}
                          className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-blue-100"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="flex items-start gap-2 pr-8">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">About Merged Optimizations</p>
                            <p>
                              When you see "Merged with existing optimization", it means the system detected a duplicate optimization request 
                              and combined it with an existing one. The optimization will use the <strong>latest data</strong> from your dataset 
                              when it runs, so your recent changes (data cleaning, edits, etc.) will be included.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {skippedOptimizations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No merged optimizations
                      </div>
                    ) : (
                      skippedOptimizations.map((batch, index) => (
                        <BatchCard
                          key={`skipped-${batch.batchId}-${index}`}
                          batch={batch}
                          onCancel={cancelOptimization}
                          onPause={pauseOptimization}
                          onResume={resumeOptimization}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="failed" className="mt-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {failedOptimizations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No failed optimizations
                      </div>
                    ) : (
                      failedOptimizations.map((batch, index) => (
                        <BatchCard
                          key={`failed-${batch.batchId}-${index}`}
                          batch={batch}
                          onCancel={cancelOptimization}
                          onPause={pauseOptimization}
                          onResume={resumeOptimization}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex justify-between mt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleClearCompleted}
                    disabled={completedOptimizations.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Completed
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResetAll}
                    disabled={skuGroups.length === 0}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Reset All
                  </Button>
                </div>
                <Button onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};