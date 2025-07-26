-- Migration: Add optimizationId column to jobs table
ALTER TABLE jobs ADD COLUMN optimizationId TEXT; 