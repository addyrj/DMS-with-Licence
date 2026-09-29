// src/modules/clients/clients.controller.js
import asyncHandler     from '../../utils/asyncHandler.js';
import { success }      from '../../utils/response.js';
import { parsePage, paginatedSuccess } from '../../utils/pagination.js';
import * as svc         from './clients.service.js';
import { executeQuery } from '../../config/database.js';
import multer           from 'multer';
import path             from 'path';
import fs                from 'fs';

// ── Logo upload middleware (exported so routes.js can use it) ─────────
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `client_${req.params.id}${ext}`);
  },
});
export const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── Standard CRUD ─────────────────────────────────────────────────────
export const listClients        = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getAllClients({ limit, offset });
  paginatedSuccess(res, success, 'clients', rows, total, { page, limit });
});
export const getClient          = asyncHandler(async (req, res) => success(res, { client:  await svc.getClientById(req.params.id) }));
export const createClient       = asyncHandler(async (req, res) => success(res, { client:  await svc.createClient(req.body) }, 201));
export const editClient         = asyncHandler(async (req, res) => success(res, { client:  await svc.updateClient(req.params.id, req.body) }));
export const toggleStatus       = asyncHandler(async (req, res) => success(res, { client:  await svc.toggleClientStatus(req.params.id) }));
export const addStorage         = asyncHandler(async (req, res) => success(res, { client:  await svc.upgradeStorage(req.params.id, req.body.additional_gb) }));
export const changeSubscription = asyncHandler(async (req, res) => success(res, { client:  await svc.updateSubscription(req.params.id, req.body.days) }));
export const removeClient       = asyncHandler(async (req, res) => success(res, await svc.deleteClient(req.params.id)));
export const editPermissions    = asyncHandler(async (req, res) => success(res, { client:  await svc.updatePermissions(req.params.id, req.body) }));
export const subscriptionLogs   = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const { rows, total } = await svc.getSubscriptionLogs(req.params.id, { limit, offset });
  paginatedSuccess(res, success, 'logs', rows, total, { page, limit });
});

// ── Logo upload ───────────────────────────────────────────────────────
export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const logoPath = `/uploads/logos/${req.file.filename}`;
  const client = await svc.updateClientLogo(req.params.id, logoPath);
  success(res, { client });
});

// ── Reset client admin password (SA only) ────────────────────────────
export const resetAdminPassword = asyncHandler(async (req, res) => {
  success(res, await svc.resetAdminPassword(req.params.id, req.body.new_password));
});

// ── SA views displays for a specific client ───────────────────────────
export const clientDisplays = asyncHandler(async (req, res) => {
  const client = await svc.getClientById(req.params.id);
  const { page, limit, offset } = parsePage(req.query);
  const [{ total }] = await executeQuery(
    'SELECT COUNT(*) as total FROM displays WHERE client_id = ?', [req.params.id], client.database_name
  );
  const displays = await executeQuery(
    `SELECT id, display_name, display_number, status, last_heartbeat,
            volume_level, storage_available, created_at,
            COALESCE((SELECT SUM(mb.file_size_mb) FROM media_bucket mb
                      WHERE mb.file_name LIKE CONCAT('%', displays.display_number, '%')), 0) AS media_storage_mb
     FROM displays WHERE client_id = ? ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [req.params.id, limit, offset], client.database_name
  );
  paginatedSuccess(res, success, 'displays', displays, total, { page, limit });
});

// ── SA views users for a specific client ─────────────────────────────
export const clientUsers = asyncHandler(async (req, res) => {
  const client = await svc.getClientById(req.params.id);
  const { page, limit, offset } = parsePage(req.query);
  const [{ total }] = await executeQuery('SELECT COUNT(*) as total FROM users', [], client.database_name);
  const users = await executeQuery(
    `SELECT u.id, u.username, u.email, u.is_active, u.created_at,
            eu.production_line_id, eu.assigned_display_id, eu.has_delete_permission
     FROM users u
     LEFT JOIN employee_users eu ON eu.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset], client.database_name
  );
  paginatedSuccess(res, success, 'users', users, total, { page, limit });
});

export const addDisplays = asyncHandler(async (req, res) => {
  const client = await svc.upgradeDisplays(req.params.id, req.body.additional_displays);
  success(res, { client });
});

// ── FIX: hierarchical production-line → displays view ─────────────────
export const linesWithDisplays = asyncHandler(async (req, res) =>
  success(res, await svc.getClientLinesWithDisplays(req.params.id)));

// ── FIX: SA can remove a user / display directly from client detail ───
export const removeClientUser = asyncHandler(async (req, res) =>
  success(res, await svc.deleteClientUser(req.params.id, req.params.userId)));

export const removeClientDisplay = asyncHandler(async (req, res) =>
  success(res, await svc.deleteClientDisplay(req.params.id, req.params.displayId)));
