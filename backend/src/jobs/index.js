// src/jobs/index.js
// Job scheduler — start/stop all background jobs

import { startSubscriptionExpiry, stopSubscriptionExpiry } from './subscriptionExpiry.js';
import { startOfflineDetector,    stopOfflineDetector    } from './offlineDetector.js';

export const startJobs = () => {
  startSubscriptionExpiry();
  startOfflineDetector();
};

export const stopJobs = () => {
  stopSubscriptionExpiry();
  stopOfflineDetector();
};
