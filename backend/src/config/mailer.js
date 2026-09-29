// src/config/mailer.js
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtpout.secureserver.net',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'sopoffline@iottechsmart.com',
    pass: process.env.SMTP_PASS || '',
  },
});

export const sendMail = async ({ to, subject, html, attachments = [] }) => {
  try {
    await transporter.sendMail({
      from: `"IOTtech DMS" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to, subject, html, attachments,
    });
    logger.info(`[Mail] Sent → ${to}: ${subject}`);
    return true;
  } catch (err) {
    logger.warn(`[Mail] Failed → ${to}: ${err.message}`);
    return false;
  }
};