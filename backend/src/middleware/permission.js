// src/middleware/permission.js
// Client-level permission guard (reads from master.clients)
// Usage: checkPermission('perm_upload_files')

import { executeQuery } from '../config/database.js';
import { ROLES }        from '../constants/roles.js';
import { error }        from '../utils/response.js';

export const checkPermission = (flag) => async (req, res, next) => {
  // Super admin always passes
  if (req.user?.role === ROLES.SUPER_ADMIN) return next();

  const client_id = req.user?.client_id;
  if (!client_id) return error(res, 'Client context missing', 403);

  const [client] = await executeQuery(
    `SELECT ${flag} AS allowed FROM clients WHERE id = ?`,
    [client_id],
    'master'
  );

  if (!client || !client.allowed)
    return error(res, `Permission denied: ${flag}`, 403);

  next();
};
