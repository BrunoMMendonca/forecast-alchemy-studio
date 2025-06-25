import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUnifiedState } from './useUnifiedState';
import { ForecastResult } from '@/types/forecast';

export interface JobStatus {
  id: number;
  sku: string;
  modelId: string;
  method: 'grid' | 'ai';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  result?: any;
  createdAt: string;
  updatedAt: string;
  reason?: string;
  priority?: number;
  batchId?: string;
}

export interface JobSummary {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  isOptimizing: boolean;
  progress: number;
  batchTotal: number;
  batchCompleted: number;
}

const POLLING_INTERVAL = 3000; // 3 seconds

export const useBackendJobStatus = (batchId: string | null) => {
  const { toast } = useToast();
  const { forecastResults, setForecastResults } = useUnifiedState();
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const processedJobIds = useRef(new Set<number>());
  const lastBatchTotalRef = useRef(0);
  const lastJobsCountRef = useRef(0);

  useEffect(() => {
    if (isPaused) return;

    const fetchStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/jobs/status');
        if (!response.ok) {
          throw new Error('Failed to fetch job status from backend.');
        }
        const data: JobStatus[] = await response.json();
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
          console.error('Backend returned non-array data:', data);
          // Handle the case where the backend sends the summary object directly
          if (data && typeof data === 'object' && 'total' in data && 'jobs' in data) {
            const jobData = (data as any).jobs || [];
            if (!Array.isArray(jobData)) {
               setJobs([]);
               return;
            }
            setJobs(jobData);
          } else {
            setJobs([]);
            return;
          }
        } else {
            setJobs(data);
        }

        // --- FIX: Process completed jobs and update global state ---
        const newlyCompletedJobs = data.filter(job => 
            job.status === 'completed' && 
            job.result && 
            !processedJobIds.current.has(job.id)
        );

        if (newlyCompletedJobs.length > 0) {
            console.log(`[useBackendJobStatus] Found ${newlyCompletedJobs.length} new completed jobs to process.`);
            const newResults: ForecastResult[] = newlyCompletedJobs.map(job => job.result as ForecastResult);
            
            const prevResults = forecastResults || [];
            const existingResultIds = new Set(prevResults.map(r => `${r.sku}-${r.model}`));
            const filteredNewResults = newResults.filter(nr => !existingResultIds.has(`${nr.sku}-${nr.model}`));
            
            if(filteredNewResults.length > 0) {
              setForecastResults([...prevResults, ...filteredNewResults]);
            }

            newlyCompletedJobs.forEach(job => processedJobIds.current.add(job.id));
        }

      } catch (error) {
        console.error("Error fetching job status:", error);
        // Set empty state on error
        setJobs([]);
      }
    };

    fetchStatus(); // Initial fetch
    const intervalId = setInterval(fetchStatus, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPaused]);

  useEffect(() => {
    const total = jobs.length;
    const pending = jobs.filter(job => job.status === 'pending').length;
    const running = jobs.filter(job => job.status === 'running').length;
    const completed = jobs.filter(job => job.status === 'completed').length;
    const failed = jobs.filter(job => job.status === 'failed').length;
    const cancelled = jobs.filter(job => job.status === 'cancelled').length;

    // If all jobs are done, reset the batch
    if (pending === 0 && running === 0 && total > 0 && (completed + failed + cancelled === total)) {
      lastBatchTotalRef.current = 0;
      lastJobsCountRef.current = 0;
    }

    // If new jobs are added after all jobs were done, start a new batch
    if (total > lastJobsCountRef.current && (pending > 0 || running > 0)) {
      lastBatchTotalRef.current = total;
    }

    lastJobsCountRef.current = total;
  }, [jobs]);

  // Group jobs by batchId
  const jobsByBatch: Record<string, JobStatus[]> = jobs.reduce((acc, job) => {
    if (!job.batchId) return acc;
    if (!acc[job.batchId]) acc[job.batchId] = [];
    acc[job.batchId].push(job);
    return acc;
  }, {} as Record<string, JobStatus[]>);

  // Robust badge counters
  const activeBatchIdsRef = useRef<string[]>([]);
  const totalActiveJobsRef = useRef(0);
  const totalFinishedJobsRef = useRef(0);

  useEffect(() => {
    // Get all batchIds in the DB
    const allBatchIds = Object.keys(jobsByBatch);

    // Find unfinished batchIds
    const unfinishedBatchIds = allBatchIds.filter(batchId =>
      jobsByBatch[batchId].some(job => job.status === 'pending' || job.status === 'running')
    );

    // If all jobs are finished, reset everything
    if (unfinishedBatchIds.length === 0) {
      activeBatchIdsRef.current = [];
      totalActiveJobsRef.current = 0;
      totalFinishedJobsRef.current = 0;
      return;
    }

    // Add any new batchIds to the active set and increment total jobs
    allBatchIds.forEach(batchId => {
      if (!activeBatchIdsRef.current.includes(batchId)) {
        activeBatchIdsRef.current.push(batchId);
        totalActiveJobsRef.current += jobsByBatch[batchId].length;
      }
    });

    // Count finished jobs in all active batches
    let finished = 0;
    activeBatchIdsRef.current.forEach(batchId => {
      finished += jobsByBatch[batchId].filter(job =>
        job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
      ).length;
    });
    totalFinishedJobsRef.current = finished;
  }, [jobsByBatch]);

  // Find batchIds with unfinished jobs (for filteredJobs)
  const unfinishedBatchIds = Object.entries(jobsByBatch)
    .filter(([batchId, batchJobs]) =>
      batchJobs.some(job => job.status === 'pending' || job.status === 'running')
    )
    .map(([batchId]) => batchId);

  // Only show jobs from unfinished batches
  const filteredJobs = jobs.filter(job => job.batchId && unfinishedBatchIds.includes(job.batchId));

  const summary = useMemo(() => {
    const total = filteredJobs.length;
    const pending = filteredJobs.filter(job => job.status === 'pending').length;
    const running = filteredJobs.filter(job => job.status === 'running').length;
    const completed = filteredJobs.filter(job => job.status === 'completed').length;
    const failed = filteredJobs.filter(job => job.status === 'failed').length;
    const cancelled = filteredJobs.filter(job => job.status === 'cancelled').length;
    const isOptimizing = pending > 0 || running > 0;
    const totalProcessable = total - cancelled;
    const progress = totalProcessable > 0 ? Math.round(((completed + failed) / totalProcessable) * 100) : 0;
    // Use robust counters for the badge
    const batchTotal = totalActiveJobsRef.current;
    const batchCompleted = totalFinishedJobsRef.current;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      cancelled,
      isOptimizing,
      progress,
      batchTotal,
      batchCompleted
    };
  }, [filteredJobs]);

  return { jobs: filteredJobs, summary, isPaused, setIsPaused };
}; 