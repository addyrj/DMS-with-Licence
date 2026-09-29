// src/middleware/tvTenantResolver.js
// TV devices don't carry JWT — they send db_name in request body/query
// This middleware sets req.dbName from that value after verifying it exists

import { executeQuery } from '../config/database.js';
import { error }        from '../utils/response.js';

export const tvTenantResolver = async (req, res, next) => {
  const dbName = req.body?.db_name || req.query?.db_name;
  if (!dbName) return error(res, 'db_name is required', 400);

  // Verify this DB actually belongs to an active client
  const [client] = await executeQuery(
    'SELECT id, is_active FROM clients WHERE database_name = ?',
    [dbName],
    'master'
  );

  if (!client)            return error(res, 'Unknown client database', 403);
  if (!client.is_active)  return error(res, 'Client account inactive', 403);

  req.dbName   = dbName;
  req.clientId = client.id;
  next();
};
