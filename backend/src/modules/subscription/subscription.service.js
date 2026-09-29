// src/modules/subscription/subscription.service.js
import { executeQuery } from '../../config/database.js';
import { sendMail }     from '../../config/mailer.js';
import logger           from '../../utils/logger.js';

export const getSubscriptionStatus = async (clientId) => {
  const rows = await executeQuery(
    `SELECT id, company_name, subscription_end, subscription_start,
            devices_required, total_storage_gb, used_storage_gb, pricing
     FROM clients WHERE id=?`, [clientId], 'master'
  );
  const client = Array.isArray(rows) ? rows[0] : rows;
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode:404, isOperational:true });
  const daysLeft = Math.ceil((new Date(client.subscription_end) - new Date()) / 86400000);
  return { ...client, days_left:daysLeft, is_expired:daysLeft<0, is_expiring:daysLeft>=0&&daysLeft<=7 };
};

// Called daily by cron — sends email + DB notification if expiring within 7 days
export const checkAndNotifyExpiry = async () => {
  const clients = await executeQuery(
    `SELECT id, company_name, admin_email, subscription_end, devices_required
     FROM clients
     WHERE is_active=1
       AND subscription_end BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    [], 'master'
  );

  const list = Array.isArray(clients) ? clients : [];
  logger.info(`[Subscription] Checking expiry: ${list.length} client(s) expiring within 7 days`);

  for (const c of list) {
    const daysLeft = Math.ceil((new Date(c.subscription_end) - new Date()) / 86400000);
    const expiryDate = new Date(c.subscription_end).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

    // Insert notification (once per day — check if already sent today)
    try {
      const existing = await executeQuery(
        `SELECT id FROM notifications WHERE created_by='system' AND title LIKE ? AND DATE(created_at)=CURDATE()`,
        [`%${c.company_name}%`], 'master'
      );
      if (!existing?.length) {
        await executeQuery(
          `INSERT INTO notifications (title, message, type, target, created_by) VALUES (?,?,'urgent','all','system')`,
          [
            `⚠️ Subscription Expiring — ${c.company_name}`,
            `${c.company_name} subscription expires in ${daysLeft} day(s) on ${expiryDate}. Please renew.`,
          ], 'master'
        );
      }
    } catch {}

    // Send email to admin
    if (c.admin_email) {
      await sendMail({
        to: c.admin_email,
        subject: `⚠️ Your DMS subscription expires in ${daysLeft} day(s)`,
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px">
            <div style="background:#F59E0B;color:white;padding:16px 20px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;font-size:20px">⚠️ Subscription Expiring Soon</h2>
            </div>
            <div style="border:1px solid #FDE68A;border-top:none;padding:20px;border-radius:0 0 8px 8px">
              <p>Dear <strong>${c.company_name}</strong> Team,</p>
              <p>Your DMS Digital Signage subscription is expiring in <strong style="color:#D97706">${daysLeft} day(s)</strong>.</p>
              <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:6px;padding:16px;margin:16px 0">
                <p style="margin:0"><strong>Expiry Date:</strong> ${expiryDate}</p>
                <p style="margin:8px 0 0"><strong>Displays:</strong> ${c.devices_required} TVs</p>
                <p style="margin:8px 0 0"><strong>Monthly:</strong> ₹${c.devices_required * 200}</p>
              </div>
              <p>Please log in to your admin panel and renew your subscription to avoid service interruption.</p>
              <p style="color:#6B7280;font-size:12px;margin-top:20px">IOTtech Smart Products Pvt. Ltd. | support@iottech.in</p>
            </div>
          </div>`,
      });
    }

    // Email to super admin
    const saEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@industrysop.com';
    await sendMail({
      to: saEmail,
      subject: `⚠️ Client Expiring: ${c.company_name} (${daysLeft} days left)`,
      html: `<div style="font-family:Arial,sans-serif;padding:20px"><h3>Subscription Expiry Alert</h3><p><strong>${c.company_name}</strong> subscription expires in <strong>${daysLeft} day(s)</strong> on ${expiryDate}.</p><p>Displays: ${c.devices_required} | Monthly: ₹${c.devices_required * 200}</p></div>`,
    });
  }

  return { checked: list.length };
};
