// src/modules/profile/profile.routes.js
import { Router }    from 'express';
import asyncHandler  from '../../utils/asyncHandler.js';
import { success }   from '../../utils/response.js';
import { authorize } from '../../middleware/authorize.js';
import { ROLES }     from '../../constants/roles.js';
import { updateProfile, updateClientLogo, getClientById } from '../clients/clients.service.js';
import multer from 'multer';
import path   from 'path';
import fs     from 'fs';

const router  = Router();
const admin   = authorize(ROLES.CLIENT_ADMIN);
const anyUser = authorize(ROLES.CLIENT_ADMIN, ROLES.EMPLOYEE);

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `client_${req.user.client_id}${ext}`);
  },
});
const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET — employees can read (needed for sidebar logo)
router.get('/', anyUser, asyncHandler(async (req, res) => {
  const client = await getClientById(req.user.client_id);
  success(res, { client });
}));

// PATCH — only admin can update profile
router.patch('/', admin, asyncHandler(async (req, res) => {
  const client = await updateProfile(req.user.client_id, req.dbName, req.user.username, req.body);
  success(res, { client });
}));

// POST logo — only admin can upload
router.post('/logo', admin, logoUpload.single('logo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const logoPath = `/uploads/logos/${req.file.filename}`;
  const client = await updateClientLogo(req.user.client_id, logoPath);
  success(res, { client });
}));

export default router;