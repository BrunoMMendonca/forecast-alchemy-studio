import express from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import jobsRoutes from './jobs.js';
import datasetsRoutes from './datasets.js';
import modelsRoutes from './models.js';
import optimizationsRoutes from './optimizations.js';
import aiRoutes from './ai.js';
import setupRoutes from './setup.js';
import sopRoutes from './sop.js';
import organizationRoutes from './organization.js';
import settingsRoutes from './settings.js';

const router = express.Router();

// Mount all route modules
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/jobs', jobsRoutes);
router.use('/', datasetsRoutes);
router.use('/models', modelsRoutes);
router.use('/optimizations', optimizationsRoutes);
router.use('/', aiRoutes);
router.use('/setup', setupRoutes);
router.use('/sop-cycles', sopRoutes);
router.use('/', organizationRoutes);
router.use('/settings', settingsRoutes);

export default router; 