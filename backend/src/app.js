// src/app.js
// UPDATED: Added announcementRoutes
import express from 'express';
import path    from 'path';
import { fileURLToPath } from 'url';
import { securityMiddleware }  from './middleware/security.js';
import { errorHandler }        from './middleware/errorHandler.js';
import { authenticateToken }   from './middleware/auth.js';
import { tenantResolver }      from './middleware/tenantResolver.js';

import './events/index.js';
import logger from './utils/logger.js';

import authRoutes               from './modules/auth/auth.routes.js';
import clientRoutes             from './modules/clients/clients.routes.js';
import userRoutes               from './modules/users/users.routes.js';
import displayRoutes            from './modules/displays/displays.routes.js';
import productionLineRoutes     from './modules/productionLines/productionLines.routes.js';
import mediaBucketRoutes        from './modules/mediaBucket/mediaBucket.routes.js';
import mediaContentRoutes       from './modules/mediaContent/mediaContent.routes.js';
import publishRoutes            from './modules/publish/publish.routes.js';
import contentAssignmentRoutes  from './modules/contentAssignments/contentAssignments.routes.js';
import tvRoutes                 from './modules/tv/tv.routes.js';
import dashboardRoutes          from './modules/dashboard/dashboard.routes.js';
import profileRoutes            from './modules/profile/profile.routes.js';
import notificationRoutes       from './modules/notifications/notifications.routes.js';
import storageRoutes            from './modules/storage/storage.routes.js';
import healthRoutes             from './modules/health/health.routes.js';
// NEW: Display announcement ticker
import announcementRoutes       from './modules/announcements/announcements.routes.js';
import subscriptionRoutes from './modules/subscription/subscription.routes.js';
import paymentRoutes from './modules/payment/payment.routes.js';
import cron from 'node-cron';
import { checkAndNotifyExpiry } from './modules/subscription/subscription.service.js';



const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();

// FIX: Behind Apache reverse proxy
app.set('trust proxy', 1);

app.use(securityMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads/logos')));
app.use('/tvfiles', express.static(path.join(__dirname, '../tvfiles')));

// Public routes
app.use('/health',   healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tv',   tvRoutes);

// Protected routes
app.use('/api', authenticateToken, tenantResolver);
app.use('/api/dashboard',            dashboardRoutes);
app.use('/api/superadmin/clients',   clientRoutes);
app.use('/api/users',                userRoutes);
app.use('/api/displays',             displayRoutes);
app.use('/api/production-lines',     productionLineRoutes);
app.use('/api/media',                mediaBucketRoutes);
app.use('/api/media-content',        mediaContentRoutes);
app.use('/api/content-assignments',  contentAssignmentRoutes);
app.use('/api/publish',              publishRoutes);
app.use('/api/profile',              profileRoutes);
app.use('/api/notifications',        notificationRoutes);
app.use('/api/storage',              storageRoutes);
app.use('/api/announcements',        announcementRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('*', (req, res) =>
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` })
);
// Run daily at 9:00 AM — check subscriptions expiring within 7 days
cron.schedule('0 9 * * *', async () => {
  logger.info('[Cron] Running subscription expiry check...');
  try {
    const result = await checkAndNotifyExpiry();
    logger.info(`[Cron] Expiry check done: ${result.checked} clients notified`);
  } catch (err) {
    logger.error('[Cron] Expiry check failed:', err.message);
  }
});

// Also run once on startup (for testing)
if (process.env.NODE_ENV === 'development') {
  checkAndNotifyExpiry().catch(() => {});
}

app.use(errorHandler);

export default app;