// src/jobs/subscriptionExpiry.js
// src/jobs/subscriptionExpiry.js
import { executeQuery } from '../config/database.js';
import logger           from '../utils/logger.js';

let timer = null;

const check = async () => {
  try {
    const result = await executeQuery(
      `UPDATE clients SET is_active = 0
       WHERE subscription_end < CURDATE() AND is_active = 1`,
      [], 'master'
    );
    if (result.affectedRows > 0)
      logger.info(`⏰ Subscription expiry: ${result.affectedRows} client(s) deactivated`);
  } catch (err) {
    logger.warn(`⏰ Subscription expiry check failed: ${err.message}`);
  }
};

export const startSubscriptionExpiry = () => {
  setTimeout(check, 5000);            // ← delay 5s, NOT immediate
  timer = setInterval(check, 60_000);
  logger.info('⏰ Subscription expiry job started (60s interval)');
};

export const stopSubscriptionExpiry = () => {
  if (timer) clearInterval(timer);
};
