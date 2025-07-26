-- Clear all content from optimization_jobs table for testing
-- This will remove all jobs and allow you to test job creation from scratch

-- First, let's see what we're about to delete
SELECT 
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
    COUNT(CASE WHEN status = 'running' THEN 1 END) as running_jobs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs
FROM optimization_jobs;

-- Clear all jobs
DELETE FROM optimization_jobs;

-- Verify the table is empty
SELECT COUNT(*) as remaining_jobs FROM optimization_jobs;

-- Reset the sequence (optional - only if you want to start job IDs from 1 again)
-- ALTER SEQUENCE optimization_jobs_id_seq RESTART WITH 1;

-- Show table status
SELECT 
    'optimization_jobs table cleared successfully' as status,
    COUNT(*) as total_jobs
FROM optimization_jobs; 