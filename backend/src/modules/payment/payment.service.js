// src/modules/payment/payment.service.js
import { executeQuery } from '../../config/database.js';
import { sendMail }     from '../../config/mailer.js';
import { generateInvoicePdf } from '../../utils/generateInvoicePdf.js';
import logger           from '../../utils/logger.js';
import Razorpay         from 'razorpay';
import crypto           from 'crypto';

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || 'rzp_test_REPLACE_ME';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'REPLACE_ME';
const PRICE_PER_DISPLAY   = 200;
const PRICE_PER_GB        = 200;
const GST_RATE            = 0.18;  // 18% GST hardcoded

const addGST = (base) => ({
  base,
  gst:   Math.round(base * GST_RATE),
  total: Math.round(base * (1 + GST_RATE)),
});

let razorpay;
try {
  const Rz = Razorpay.default || Razorpay;
  razorpay = new Rz({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
} catch { razorpay = null; }

const getClient = async (clientId) => {
  const rows = await executeQuery(
    'SELECT id, company_name, admin_email, database_name, devices_required, total_storage_gb, used_storage_gb, subscription_end, pricing FROM clients WHERE id=?',
    [clientId], 'master'
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

// ── Invoice HTML ─────────────────────────────────────────────
const invoiceHtml = ({ invoiceNo, date, client, item, qty, unitPrice, total, paymentId, newPlan }) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #0D9488; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 24px; }
  .header p { margin: 4px 0 0; opacity: 0.85; font-size: 13px; }
  .body { border: 1px solid #E5E7EB; border-top: none; padding: 24px; border-radius: 0 0 8px 8px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F3F4F6; }
  .row:last-child { border-bottom: none; }
  .label { color: #6B7280; font-size: 13px; }
  .value { font-weight: 600; font-size: 13px; }
  .total-row { background: #F0FDFA; padding: 12px 16px; border-radius: 6px; margin: 16px 0; display: flex; justify-content: space-between; }
  .total-label { font-weight: 700; color: #0D9488; }
  .total-value { font-weight: 800; font-size: 20px; color: #0D9488; }
  .plan-box { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin-top: 16px; }
  .plan-title { font-weight: 700; margin-bottom: 8px; }
  .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9CA3AF; }
  .success { background: #D1FAE5; color: #065F46; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; }
</style></head>
<body>
  <div class="header">
    <h1>Payment Invoice</h1>
    <p>IOTtech Smart Products Pvt. Ltd.</p>
  </div>
  <div class="body">
    <div class="row"><span class="label">Invoice No</span><span class="value">INV-${invoiceNo}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
    <div class="row"><span class="label">Client</span><span class="value">${client.company_name}</span></div>
    <div class="row"><span class="label">Payment ID</span><span class="value">${paymentId} &nbsp;<span class="success">✅ Paid</span></span></div>

    <h3 style="margin: 20px 0 8px; font-size: 14px; color: #374151;">Purchase Details</h3>
    <div class="row"><span class="label">Item</span><span class="value">${item}</span></div>
    <div class="row"><span class="label">Quantity</span><span class="value">${qty}</span></div>
    <div class="row"><span class="label">Unit Price</span><span class="value">₹${unitPrice}</span></div>

    <div class="row"><span class="label">Base Amount</span><span class="value">₹${Math.round(total/1.18).toLocaleString('en-IN')}</span></div>
    <div class="row"><span class="label">GST (18%)</span><span class="value">₹${Math.round(total - total/1.18).toLocaleString('en-IN')}</span></div>
    <div class="total-row">
      <span class="total-label">TOTAL PAID (incl. GST)</span>
      <span class="total-value">₹${total.toLocaleString('en-IN')}</span>
    </div>
    <div style="font-size:11px;color:#6B7280;margin-top:4px">* GST @ 18% included in total</div>

    <div class="plan-box">
      <div class="plan-title">📊 Updated Plan Details</div>
      <div class="row"><span class="label">Displays</span><span class="value">${newPlan.displays} TVs</span></div>
      <div class="row"><span class="label">Storage</span><span class="value">${newPlan.storage} GB</span></div>
      <div class="row"><span class="label">Subscription</span><span class="value">Active until ${newPlan.subscriptionEnd}</span></div>
    </div>
  </div>
  <div class="footer">
    <p>IOTtech Smart Products Pvt. Ltd. | support@iottech.in</p>
    <p>This is an auto-generated invoice. Please keep it for your records.</p>
  </div>
</body>
</html>`;

// ── Get quote ─────────────────────────────────────────────────
export const getQuote = async (clientId) => {
  const client = await getClient(clientId);
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode:404, isOperational:true });
  return {
    price_per_display_inr: PRICE_PER_DISPLAY,
    price_per_gb_inr:      PRICE_PER_GB,
    price_per_month_inr:   client.devices_required * PRICE_PER_DISPLAY,
    current_displays:      client.devices_required,
    current_storage_gb:    client.total_storage_gb,
    subscription_end:      client.subscription_end,
    razorpay_key:          RAZORPAY_KEY_ID,
  };
};

// ── Create order ──────────────────────────────────────────────
export const createOrder = async (clientId, { type, quantity = 1, months = 1 }) => {
  const client = await getClient(clientId);
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode:404, isOperational:true });

  let amountPaise = 0;
  let description = '';
  if      (type === 'display')      {
    const g = addGST(quantity * PRICE_PER_DISPLAY);
    amountPaise = g.total * 100;
    description = `Add ${quantity} display(s) — Base ₹${quantity * PRICE_PER_DISPLAY} + GST ₹${g.gst} = ₹${g.total}`;
  }
  else if (type === 'storage')      {
    const g = addGST(quantity * PRICE_PER_GB);
    amountPaise = g.total * 100;
    description = `Add ${quantity} GB storage — Base ₹${quantity * PRICE_PER_GB} + GST ₹${g.gst} = ₹${g.total}`;
  }
  else if (type === 'subscription') {
    const perMonth = client.devices_required * PRICE_PER_DISPLAY;
    const g = addGST(perMonth * months);
    amountPaise = g.total * 100;
    description = `Renew ${months} month(s) — Base ₹${perMonth * months} + GST ₹${g.gst} = ₹${g.total}`;
  } else throw Object.assign(new Error('Invalid payment type'), { statusCode:400, isOperational:true });

  let razorpayOrderId = `mock_${Date.now()}`;
  if (razorpay) {
    try {
      const order = await razorpay.orders.create({
        amount: amountPaise, currency: 'INR',
        receipt: `dms_${clientId}_${Date.now()}`,
        notes: { client_id: String(clientId), type, quantity: String(quantity), months: String(months) },
      });
      razorpayOrderId = order.id;
    } catch (e) { logger.warn('[Payment] Using mock mode:', e.message); }
  }

  const res = await executeQuery(
    `INSERT INTO payment_history (client_id, razorpay_order_id, payment_type, quantity, amount_paise, status, meta)
     VALUES (?,?,?,?,?,'created',?)`,
    [clientId, razorpayOrderId, type, quantity, amountPaise,
     JSON.stringify({ months, description, per_month: client.devices_required * PRICE_PER_DISPLAY })],
    'master'
  );

  return {
    order_id:     razorpayOrderId,
    payment_id:   res.insertId,
    amount_paise: amountPaise,
    amount_inr:   amountPaise / 100,
    description,
    razorpay_key: RAZORPAY_KEY_ID,
    client_name:  client.company_name,
  };
};

// ── Verify + apply + send emails ──────────────────────────────
export const verifyAndApply = async (clientId, {
  razorpay_order_id, razorpay_payment_id, razorpay_signature,
  payment_db_id, type, quantity, months = 1,
}) => {
  // Verify signature (skip for mock)
  if (razorpay && razorpay_signature && !razorpay_order_id?.startsWith('mock_')) {
    const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected !== razorpay_signature)
      throw Object.assign(new Error('Payment verification failed'), { statusCode:400, isOperational:true });
  }

  const paidId = razorpay_payment_id || `mock_pay_${Date.now()}`;

  // Mark paid
  await executeQuery(
    "UPDATE payment_history SET status='paid', razorpay_payment_id=? WHERE id=? AND client_id=?",
    [paidId, payment_db_id, clientId], 'master'
  );

  const client = await getClient(clientId);
  let updateMsg = '';
  let item = '', unitPrice = 0, qty = Number(quantity) || 1;

  if (type === 'display') {
    await executeQuery('UPDATE clients SET devices_required = devices_required + ? WHERE id=?', [qty, clientId], 'master');
    updateMsg = `Added ${qty} display(s)`;
    item = `Display(s) Added`; unitPrice = PRICE_PER_DISPLAY;
  } else if (type === 'storage') {
    await executeQuery('UPDATE clients SET total_storage_gb = total_storage_gb + ? WHERE id=?', [qty, clientId], 'master');
    updateMsg = `Added ${qty} GB storage`;
    item = `Storage Added`; unitPrice = PRICE_PER_GB;
  } else if (type === 'subscription') {
    const base = new Date(client.subscription_end) > new Date() ? new Date(client.subscription_end) : new Date();
    base.setDate(base.getDate() + (months * 30));
    const newEnd = base.toISOString().split('T')[0];
    await executeQuery('UPDATE clients SET subscription_end=? WHERE id=?', [newEnd, clientId], 'master');
    updateMsg = `Subscription extended to ${newEnd}`;
    item = `Subscription Renewal (${months} month${months > 1 ? 's' : ''})`; unitPrice = client.devices_required * PRICE_PER_DISPLAY; qty = months;
  }

  // Get updated client
  const updatedClient = await getClient(clientId);
  const amountInr = Math.round((await executeQuery('SELECT amount_paise FROM payment_history WHERE id=?', [payment_db_id], 'master'))?.[0]?.amount_paise / 100) || 0;
  const invoiceNo = `${clientId}${payment_db_id}${Date.now().toString().slice(-4)}`;
  const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

  const newPlan = {
    displays:        updatedClient?.devices_required || 0,
    storage:         updatedClient?.total_storage_gb || 0,
    subscriptionEnd: new Date(updatedClient?.subscription_end).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }),
  };

  const html = invoiceHtml({ invoiceNo, date, client, item, qty, unitPrice, total: amountInr, paymentId: paidId, newPlan });
// Generate PDF
let pdfBuffer = null;
try {
  pdfBuffer = await generateInvoicePdf({ invoiceNo, date, client, item, qty, unitPrice, total: amountInr, paymentId: paidId, newPlan });
} catch(e) { logger.warn('PDF failed:', e.message); }

const pdfAttachment = pdfBuffer ? [{ filename: `Invoice-INV-${invoiceNo}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [];
  // Send invoice to admin
  if (client.admin_email) {
    await sendMail({
      to: client.admin_email,
      subject: `✅ Payment Successful — ${item} | ₹${amountInr.toLocaleString('en-IN')}`,
      html,
      attachments: pdfAttachment,
    });
  }

  // Send notification to super admin
  const saEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@industrysop.com';
  await sendMail({
    to: saEmail,
    subject: `💳 New Payment — ${client.company_name} | ₹${amountInr.toLocaleString('en-IN')}`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:500px">
        <h2 style="color:#0D9488">New Payment Received</h2>
        <p><strong>Client:</strong> ${client.company_name}</p>
        <p><strong>Type:</strong> ${item}</p>
        <p><strong>Amount:</strong> ₹${amountInr.toLocaleString('en-IN')}</p>
        <p><strong>Payment ID:</strong> ${paidId}</p>
        <p><strong>Updated Plan:</strong> ${newPlan.displays} displays, ${newPlan.storage} GB, until ${newPlan.subscriptionEnd}</p>
        <p style="color:#6B7280;font-size:12px;margin-top:16px">DMS Digital Signage — IOTtech Smart Products</p>
      </div>`,
    attachments: pdfAttachment,
  });

  // Insert notification in DB for SA dashboard
  try {
    await executeQuery(
      `INSERT INTO notifications (title, message, type, target, created_by) VALUES (?,?,'info','all','system')`,
      [`💳 Payment — ${client.company_name}`, `${updateMsg} | ₹${amountInr}`], 'master'
    );
  } catch {}

  logger.info(`[Payment] ${client.company_name}: ${updateMsg} | ₹${amountInr} | Invoice sent to ${client.admin_email}`);
  return { success: true, message: updateMsg };
};

export const getPaymentHistory = async (clientId, { limit, offset } = {}) => {
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM payment_history WHERE client_id = ?', [clientId], 'master');
  const rows = await executeQuery(
    'SELECT * FROM payment_history WHERE client_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [clientId, limit, offset], 'master'
  );
  return { rows: Array.isArray(rows) ? rows : [], total };
};