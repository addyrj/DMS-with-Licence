// src/lib/api.js
// BUG FIX: reorderFiles and renameFolder were sending wrong body format
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

function getToken() {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/dms_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function setToken(token) {
  document.cookie = `dms_token=${encodeURIComponent(token)}; path=/; max-age=${7*24*3600}; SameSite=Lax`;
}
function clearToken() {
  document.cookie = 'dms_token=; path=/; max-age=0';
}
function isTokenExpiringSoon(token) {
  try { const { exp } = JSON.parse(atob(token.split('.')[1])); return exp - Math.floor(Date.now()/1000) < 3600; }
  catch { return false; }
}

let refreshPromise = null;
async function ensureFreshToken() {
  const token = getToken();
  if (!token || !isTokenExpiringSoon(token)) return token;
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/api/auth/refresh`, {
      method:'POST', headers:{ Authorization:`Bearer ${token}` },
    }).then(r=>r.json()).then(d=>{ if(d.token) setToken(d.token); return d.token||token; })
      .catch(()=>token).finally(()=>{ refreshPromise=null; });
  }
  return refreshPromise;
}

async function request(method, path, body, isFormData=false) {
  const token = await ensureFreshToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(()=>({}));
  if ((res.status===401||res.status===403) && !path.includes('/auth/')) {
    clearToken();
    if (typeof window!=='undefined') window.location.href='/login';
    throw new Error(data.error||'Session expired');
  }
  if (!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}

const get   = (p)    => request('GET',   p);
const post  = (p,b)  => request('POST',  p,b);
const patch = (p,b)  => request('PATCH', p,b);
const del   = (p)    => request('DELETE',p);

// Builds a "?a=1&b=2" query string, skipping undefined/null/empty values
function qs(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// Auth
export const loginSuperAdmin  = (b) => post('/api/auth/superadmin/login', b);
export const loginClient      = (b) => post('/api/auth/login', b);
export const refreshToken     = ()  => post('/api/auth/refresh');
export const logoutApi        = ()  => post('/api/auth/logout');

// Dashboard
export const getDashboardSystem  = ()   => get('/api/dashboard/system');
export const getDashboardClient  = ()   => get('/api/dashboard/client');
export const getDashboardById    = (id) => get(`/api/dashboard/client/${id}`);
export const getActivityLog      = ({ page, limit = 100, search, type } = {}) =>
  get(`/api/dashboard/activity${qs({ page, limit, search, type })}`);

// Clients (SA)
export const getClients          = ({ page, limit, search } = {}) => get(`/api/superadmin/clients${qs({ page, limit, search })}`);
export const getClient           = (id)    => get(`/api/superadmin/clients/${id}`);
export const createClient        = (b)     => post('/api/superadmin/clients', b);
export const updateClient        = (id,b)  => patch(`/api/superadmin/clients/${id}`, b);
export const deleteClient        = (id)    => del(`/api/superadmin/clients/${id}`);
export const toggleClientStatus  = (id)    => patch(`/api/superadmin/clients/${id}/status`);
export const upgradeStorage      = (id,b)  => patch(`/api/superadmin/clients/${id}/storage`, b);
export const upgradeDisplays     = (id,b)  => patch(`/api/superadmin/clients/${id}/displays`, b);
export const changeSubscription  = (id,b)  => patch(`/api/superadmin/clients/${id}/subscription`, b);
export const updatePermissions   = (id,b)  => patch(`/api/superadmin/clients/${id}/permissions`, b);
export const getSubscriptionLogs = (id, { page, limit } = {})  => get(`/api/superadmin/clients/${id}/subscription-logs${qs({ page, limit })}`);
export const getClientDisplays   = (id, { page, limit } = {})  => get(`/api/superadmin/clients/${id}/displays${qs({ page, limit })}`);
export const getClientUsers      = (id, { page, limit } = {})  => get(`/api/superadmin/clients/${id}/users${qs({ page, limit })}`);
export const getClientLines      = (id)    => get(`/api/superadmin/clients/${id}/lines`);
export const resetClientAdminPassword = (id,b) => patch(`/api/superadmin/clients/${id}/reset-password`, b);
export const uploadClientLogo = (clientId, file) => {
  const token = getToken();
  const form = new FormData(); form.append('logo', file);
  return fetch(`${BASE}/api/superadmin/clients/${clientId}/logo`, {
    method:'POST', headers: token ? { Authorization:`Bearer ${token}` } : {}, body:form,
  }).then(async r=>{ const d=await r.json(); if(!r.ok) throw new Error(d.error||'Upload failed'); return d; });
};

// Storage (SA)
export const getStorageOverview = ({ page, limit } = {}) => get(`/api/storage/overview${qs({ page, limit })}`);
export const getClientStorage   = (id, { page, limit } = {}) => get(`/api/storage/client/${id}${qs({ page, limit })}`);

// Users
export const getUsers           = ({ page, limit, search, type } = {}) => get(`/api/users${qs({ page, limit, search, type })}`);
export const getUser            = (id)    => get(`/api/users/${id}`);
export const createUser         = (b)     => post('/api/users', b);
export const updateUser         = (id,b)  => patch(`/api/users/${id}`, b);
export const deleteUser         = (id)    => del(`/api/users/${id}`);
export const toggleUserStatus   = (id)    => patch(`/api/users/${id}/toggle-status`);
export const changeUserPassword = (id,b)  => patch(`/api/users/${id}/password`, b);

// Displays
export const getDisplays          = ({ page, limit } = {}) => get(`/api/displays${qs({ page, limit })}`);
export const getDisplay           = (id)    => get(`/api/displays/${id}`);
export const getDisplayStatus     = (id)    => get(`/api/displays/${id}/status`);
export const createDisplay        = (b)     => post('/api/displays', b);
export const updateDisplay        = (id,b)  => patch(`/api/displays/${id}`, b);
export const setVolume            = (id,b)  => patch(`/api/displays/${id}/volume`, b);
export const resetDisplayPassword = (id,b)  => patch(`/api/displays/${id}/reset-password`, b);
export const deleteDisplay        = (id)    => del(`/api/displays/${id}`);
export const getDisplayErrors     = (id, { page, limit } = {}) => get(`/api/displays/${id}/errors${qs({ page, limit })}`);
export const getDisplayLimit      = ()      => get('/api/displays/limit');

// Production Lines
export const getLines            = ({ page, limit } = {}) => get(`/api/production-lines${qs({ page, limit })}`);
export const getLine             = (id)    => get(`/api/production-lines/${id}`);
export const createLine          = (b)     => post('/api/production-lines', b);
export const updateLine          = (id,b)  => patch(`/api/production-lines/${id}`, b);
export const deleteLine          = (id)    => del(`/api/production-lines/${id}`);
export const toggleActiveLine    = (id)    => patch(`/api/production-lines/${id}/active`);
export const updateLineDisplays  = (id,b)  => patch(`/api/production-lines/${id}/displays`, b);
export const updateTvOrder       = (id,b)  => patch(`/api/production-lines/${id}/tv-order`, b);
export const getAssignedDisplays = ()      => get('/api/production-lines/assigned');
export const getLineByDisplay    = (dId)   => get(`/api/production-lines/by-display/${dId}`);
export const getContentByLine    = (lId, { page, limit } = {}) => get(`/api/media-content/by-line/${lId}${qs({ page, limit })}`);

// Media Bucket
export const getFolders     = ({ page, limit } = {}) => get(`/api/media/folders${qs({ page, limit })}`);
export const getFolderFiles = (name, { page, limit } = {}) => get(`/api/media/folders/${encodeURIComponent(name)}${qs({ page, limit })}`);
export const deleteFolder   = (name)     => del(`/api/media/folders/${encodeURIComponent(name)}`);

// BUG FIX: was sending newName raw string — must be { new_name: newName }
export const renameFolder = (name, newName) =>
  patch(`/api/media/folders/${encodeURIComponent(name)}/rename`, { new_name: newName });

export const deleteMediaFile = (id) => del(`/api/media/${id}`);

// BUG FIX: was sending order array directly — must be wrapped as { order: [...] }
export const reorderFiles = (order) => patch('/api/media/sequence', { order });

export const uploadFiles = (folderName, files) => {
  const token = getToken();
  const form = new FormData();
  form.append('folder_name', folderName);
  files.forEach(f => form.append('files', f));
  return fetch(`${BASE}/api/media/upload`, {
    method:'POST', headers: token ? { Authorization:`Bearer ${token}` } : {}, body:form,
  }).then(async r=>{ const d=await r.json(); if(!r.ok) throw new Error(d.error||'Upload failed'); return d; });
};

// Media Content
export const getContent        = ({ page, limit } = {}) => get(`/api/media-content${qs({ page, limit })}`);
export const getContentById    = (id)    => get(`/api/media-content/${id}`);
export const getContentFiles   = (id, { page, limit } = {}) => get(`/api/media-content/${id}/files${qs({ page, limit })}`);
export const setDuration       = (id,b)  => patch(`/api/media-content/${id}/duration`, b);
export const setFileSequence   = (fid,b) => patch(`/api/media-content/file/${fid}/sequence`, b);
export const deleteContentFile = (fid)   => del(`/api/media-content/file/${fid}`);

export const directUpload = (formData) => {
  const token = getToken();
  return fetch(`${BASE}/api/media-content/direct-upload`, {
    method:'POST', headers: token ? { Authorization:`Bearer ${token}` } : {}, body:formData,
  }).then(async r=>{ const d=await r.json(); if(!r.ok) throw new Error(d.error||'Upload failed'); return d; });
};

// Publish
export const publishContent   = (b)  => post('/api/publish', b);
export const unpublishContent       = (b)  => post('/api/publish/unpublish', b);
export const republishContent       = (b)  => post('/api/publish/republish', b);
export const deletePublishedContent = (b)  => post('/api/publish/delete', b);
export const deletePublishHistory   = (id) => del(`/api/publish/history/${id}`);
export const getPublishStatus = (id) => get(`/api/publish/status/${id}`);

// Assignments
export const getAssignments          = ({ page, limit } = {}) => get(`/api/content-assignments${qs({ page, limit })}`);
export const getAssignmentById       = (id)    => get(`/api/content-assignments/${id}`);
export const getAssignmentsByDisplay = (id, { page, limit } = {}) => get(`/api/content-assignments/display/${id}${qs({ page, limit })}`);
export const createAssignment        = (b)     => post('/api/content-assignments', b);
export const updateAssignment        = (id,b)  => patch(`/api/content-assignments/${id}`, b);
export const toggleAssignment        = (id)    => patch(`/api/content-assignments/${id}/toggle`);
export const deleteAssignment        = (id)    => del(`/api/content-assignments/${id}`);

// Profile
export const getProfile    = ()  => get('/api/profile');
export const updateProfile = (b) => patch('/api/profile', b);
export const uploadOwnLogo = (file) => {
  const token = getToken();
  const form = new FormData(); form.append('logo', file);
  return fetch(`${BASE}/api/profile/logo`, {
    method:'POST', headers: token ? { Authorization:`Bearer ${token}` } : {}, body:form,
  }).then(async r=>{ const d=await r.json(); if(!r.ok) throw new Error(d.error||'Upload failed'); return d; });
};

// Notifications
// NOTE: default limit bumped to 50 for the bell dropdown (Header.js), which is
// not paginated — this preserves its previous "show everything" behavior.
export const getMyNotifications = ({ page, limit = 50 } = {}) => get(`/api/notifications/my${qs({ page, limit })}`);
export const getUnreadCount     = ()    => get('/api/notifications/my/unread');
export const markNotifRead      = (id)  => patch(`/api/notifications/my/${id}/read`, {});
export const markAllNotifsRead  = ()    => patch('/api/notifications/my/read-all', {});
export const getAdminNotifs     = ({ page, limit } = {}) => get(`/api/notifications/admin${qs({ page, limit })}`);
export const createNotification = (b)   => post('/api/notifications/admin', b);
export const deleteNotification = (id)  => del(`/api/notifications/admin/${id}`);

// Announcements
export const getAnnouncements        = ({ page, limit } = {}) => get(`/api/announcements${qs({ page, limit })}`);
export const createAnnouncement      = (b)   => post('/api/announcements', b);
export const deleteAnnouncement      = (id)  => del(`/api/announcements/${id}`);
export const getActiveAnnouncements  = ()    => get('/api/announcements/active');
export const getTvAnnouncements      = (tvId, dbName) => get(`/api/tv/announcements/${tvId}?db_name=${dbName}`);

// Publish History
export const getPublishHistory = ({ page, limit } = {}) => get(`/api/publish/history${qs({ page, limit })}`);

// Subscription
export const getSubscriptionStatus = () => get('/api/subscription/status');

export const getClientPaymentHistory = (id, { page, limit } = {}) => get(`/api/payment/client/${id}/history${qs({ page, limit })}`);
export const getPaymentHistory = ({ page, limit } = {}) => get(`/api/payment/history${qs({ page, limit })}`);