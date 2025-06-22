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
}

const POLLING_INTERVAL = 3000; // 3 seconds

export const useBackendJobStatus = () => {
  const { toast } = useToast();
  const { forecastResults, setForecastResults } = useUnifiedState();
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const processedJobIds = useRef(new Set<number>());

  const summary = useMemo(() => {
    const total = jobs.length;
    const pending = jobs.filter(job => job.status === 'pending').length;
    const running = jobs.filter(job => job.status === 'running').length;
    const completed = jobs.filter(job => job.status === 'completed').length;
    const failed = jobs.filter(job => job.status === 'failed').length;
    const cancelled = jobs.filter(job => job.status === 'cancelled').length;
    const isOptimizing = pending > 0 || running > 0;
    
    // Calculate overall progress
    const totalProcessable = total - cancelled; // Exclude cancelled jobs from progress calculation
    const progress = totalProcessable > 0 ? Math.round(((completed + failed) / totalProcessable) * 100) : 0;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      cancelled,
      isOptimizing,
      progress
    };
  }, [jobs]);

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

  return { jobs, summary, isPaused, setIsPaused };
}; 