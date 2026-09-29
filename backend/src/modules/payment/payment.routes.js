// src/modules/payment/payment.routes.js
import { Router }    from 'express';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import { executeQuery } from '../../config/database.js';
import * as svc from './payment.service.js';

const router  = Router();
const admin   = authorize(ROLES.CLIENT_ADMIN, ROLES.SUPER_ADMIN);
const saOnly  = authorize(ROLES.SUPER_ADMIN);

// Admin: get pricing quote
router.get('/quote', admin, asyncHandler(async (req, res) => {
  const clientId = req.clientId || req.user?.client_id;
  success(res, await svc.getQuote(clientId));
}));

// Admin: create Razorpay order
router.post('/create-order', admin, asyncHandler(async (req, res) => {
  const clientId = req.clientId || req.user?.client_id;
  const { type, quantity, months } = req.body;
  success(res, await svc.createOrder(clientId, { type, quantity: Number(quantity)||1, months: Number(months)||1 }));
}));

// Admin: verify payment + apply
router.post('/verify', admin, asyncHandler(async (req, res) => {
  const clientId = req.clientId || req.user?.client_id;
  success(res, await svc.verifyAndApply(clientId, req.body));
}));

// Admin: own payment history
router.get('/history', admin, asyncHandler(async (req, res) => {
  const clientId = req.clientId || req.user?.client_id;
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getPaymentHistory(clientId, { limit, offset });
  paginatedSuccess(res, success, 'history', rows, total, { page, limit });
}));

// ── Super Admin: view any client's payment history ────────────
router.get('/client/:clientId/history', saOnly, asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const { page, limit, offset } = parsePage(req.query);

  const [{ total }] = await executeQuery(
    'SELECT COUNT(*) as total FROM payment_history WHERE client_id = ?', [Number(clientId)], 'master'
  );
  // total_paid_inr / paid_count / pending_count must reflect ALL payments, not
  // just the current page — separate aggregate query
  const [{ totalPaidPaise, paidCount, pendingCount }] = await executeQuery(
    `SELECT COALESCE(SUM(amount_paise),0) as totalPaidPaise,
            SUM(status = 'paid')    as paidCount,
            SUM(status = 'created') as pendingCount
     FROM payment_history WHERE client_id = ?`,
    [Number(clientId)], 'master'
  );
  const rows = await executeQuery(
    `SELECT ph.*, c.company_name
     FROM payment_history ph
     JOIN clients c ON c.id = ph.client_id
     WHERE ph.client_id = ?
     ORDER BY ph.created_at DESC
     LIMIT ? OFFSET ?`,
    [Number(clientId), limit, offset], 'master'
  );
  success(res, {
    history: Array.isArray(rows) ? rows : [],
    page, limit, total, totalPages: Math.ceil(total / limit) || 0,
    total_paid_inr: Math.round(totalPaidPaise / 100),
    paid_count: Number(paidCount || 0),
    pending_count: Number(pendingCount || 0),
  });
}));

export default router;
