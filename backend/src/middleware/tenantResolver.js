// src/middleware/tenantResolver.js
// Resolves client database name from JWT → sets req.dbName
// SUPER_ADMIN always uses 'master'. CLIENT_ADMIN/EMPLOYEE use their client's DB.

import { executeQuery } from '../config/database.js';
import { ROLES }        from '../constants/roles.js';
import { error }        from '../utils/response.js';

export const tenantResolver = async (req, res, next) => {
  const { role, client_id } = req.user;

  if (role === ROLES.SUPER_ADMIN) {
    req.dbName = 'master';
    return next();
  }

  if (!client_id) return error(res, 'Client context missing', 403);

  const [client] = await executeQuery(
    'SELECT database_name, is_active, subscription_end FROM clients WHERE id = ?',
    [client_id],
    'master'
  );

  if (!client)           return error(res, 'Client not found',             403);
  if (!client.is_active) return error(res, 'Client account is inactive',   403);

  const today = new Date().toISOString().slice(0, 10);
  if (client.subscription_end < today)
    return error(res, 'Subscription expired. Contact your administrator.', 403);

  req.dbName     = client.database_name;
  req.clientData = client;
  next();
};
