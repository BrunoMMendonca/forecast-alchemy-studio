import React, { useMemo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Job } from '@/types/optimization';
import { JobSummary } from '@/hooks/useBackendJobStatus';
import { useToast } from './ui/use-toast';

// A small helper to format time
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString();
};

interface SummaryCardProps {
  title: string;
  value: number;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

const SummaryCard = ({ title, value, color }: SummaryCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
    green: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  };
  const cardClass = color ? colorClasses[color] : 'bg-gray-100 dark:bg-gray-800';
  
  return (
    <div className={cn('p-4 rounded-lg text-center', cardClass)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
};

const StatusIcon = ({ status }: { status: Job['status'] }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'running':
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-gray-400" />;
    case 'cancelled':
      return <Ban className="h-5 w-5 text-yellow-500" />;
    default:
      return null;
  }
};

const JobRow = ({ job }: { job: Job }) => {
  const priorityInfo = getPriorityInfo(job.priority);
  return (
    <TableRow>
      <TableCell className="w-[80px] text-center">
        <StatusIcon status={job.status} />
      </TableCell>
      <TableCell className="w-[150px] font-medium truncate" title={job.sku}>{job.sku}</TableCell>
      <TableCell className="w-[250px] truncate" title={job.modelId}>{job.modelId}</TableCell>
      <TableCell className="w-[100px]">
        <Badge
          variant={job.method === 'ai' ? 'default' : 'secondary'}
          className="capitalize"
        >
          {job.method}
        </Badge>
      </TableCell>
      <TableCell className="w-[150px]">
        <Badge className={cn('font-semibold', priorityInfo.className)}>
          {priorityInfo.text}
        </Badge>
      </TableCell>
      <TableCell className="w-[100px]">
        <Progress value={job.progress} />
      </TableCell>
      <TableCell className="w-[120px] text-right">
        {format(new Date(job.updatedAt), 'p')}
      </TableCell>
    </TableRow>
  );
};

const getPriorityInfo = (priority: number) => {
  switch (priority) {
    case 1:
      return { text: 'Setup', className: 'bg-blue-100 text-blue-800' };
    case 2:
      return { text: 'Data Cleaning', className: 'bg-yellow-100 text-yellow-800' };
    case 3:
      return { text: 'Historic Data Import', className: 'bg-green-100 text-green-800' };
    default:
      return { text: 'Unknown', className: 'bg-gray-100 text-gray-800' };
  }
};

interface OptimizationQueuePopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  jobs: Job[];
  summary: JobSummary;
  isPaused: boolean;
  setIsPaused: (isPaused: boolean) => void;
}

const JobQueueTable = ({ jobs }: { jobs: Job[] }) => (
  <div className="rounded-lg border">
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">Status</TableHead>
          <TableHead className="w-[150px]">SKU</TableHead>
          <TableHead className="w-[250px]">Model</TableHead>
          <TableHead className="w-[100px]">Method</TableHead>
          <TableHead className="w-[150px]">Priority</TableHead>
          <TableHead className="w-[100px]">Progress</TableHead>
          <TableHead className="w-[120px] text-right">Last Update</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
    <div className="relative overflow-y-auto h-[40vh]">
      <Table className="w-full table-fixed">
        <TableBody>
          {jobs.length > 0 ? (
            jobs.map((job) => <JobRow key={job.id} job={job} />)
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No jobs in this queue.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  </div>
);

export const OptimizationQueuePopup: React.FC<OptimizationQueuePopupProps> = ({
  isOpen,
  onOpenChange,
  jobs,
  summary,
  isPaused,
  setIsPaused,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  
  const { pendingJobs, historyJobs } = useMemo(() => {
    const pendingJobs = jobs.filter(
      (job) => job.status === 'pending' || job.status === 'running'
    );
    const historyJobs = jobs.filter(
      (job) => job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    );
    return { pendingJobs, historyJobs };
  }, [jobs]);

  const handleClearCompleted = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/jobs/clear-completed', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear completed jobs.');
      }
      toast({ title: 'Success', description: 'Cleared completed jobs.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleResetAll = async () => {
    if (window.confirm('Are you sure you want to reset all jobs? This action cannot be undone.')) {
    try {
      const response = await fetch('http://localhost:3001/api/jobs/reset', { method: 'POST' });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to reset jobs.');
        }
        toast({ title: 'Success', description: 'All jobs have been reset.' });
    } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="animate-spin" /> Job Monitor
          </DialogTitle>
          <div className="absolute top-4 right-14 flex items-center space-x-2">
                <Switch
              id="live-polling"
                  checked={!isPaused}
              onCheckedChange={() => setIsPaused(!isPaused)}
                />
            <Label htmlFor="live-polling">Live Polling</Label>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-4 my-4">
          <SummaryCard title="Total" value={summary.total} />
          <SummaryCard title="Running" value={summary.running} color="blue" />
          <SummaryCard title="Completed" value={summary.completed} color="green" />
          <SummaryCard title="Failed" value={summary.failed} color="red" />
          <SummaryCard title="Cancelled" value={summary.cancelled} color="yellow" />
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending ({pendingJobs.length})</TabsTrigger>
            <TabsTrigger value="history">History ({historyJobs.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
             <JobQueueTable jobs={pendingJobs} />
          </TabsContent>
          <TabsContent value="history">
             <JobQueueTable jobs={historyJobs} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleClearCompleted}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Completed
                   </Button>
          <Button variant="destructive" onClick={handleResetAll}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Reset All
                          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
