// src/lib/utils.js
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const fmt = {
  date:     (d) => d ? format(parseISO(String(d)), 'MMM d, yyyy · h:mm a') : '—',
  dateTime: (d) => d ? format(parseISO(String(d)), 'MMM d, yyyy HH:mm') : '—',
  ago:      (d) => d ? formatDistanceToNow(parseISO(String(d)), { addSuffix: true }) : '—',
  bytes:    (mb) => {
    const n = Number(mb) || 0;
    if (n === 0) return '0 MB';
    if (n >= 1024) return `${(n/1024).toFixed(1)} GB`;
    return `${n.toFixed(0)} MB`;
  },
  number:   (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}k` : String(n||0),
  pct:      (n) => `${Number(n||0).toFixed(1)}%`,
  currency: (n) => `₹${Number(n||0).toLocaleString('en-IN')}`,
};

// FIX: Central thumbUrl helper used across ALL pages
// Handles file_path like: "uploads/jio_db/folder/file.jpg"
// Returns: "/api/logo?path=/uploads/jio_db/folder/file.jpg"
export const thumbUrl = (filePath) => {
  if (!filePath) return null;
  const clean = filePath.replace(/^\/+/, '');
  // tvfiles/ path → serve from /tvfiles/ (NOT /uploads/)
  if (clean.startsWith('tvfiles/')) {
    return `/api/logo?path=/${clean}`;
  }
  // uploads/ path → strip prefix to avoid /uploads/uploads/
  const stripped = clean.replace(/^uploads?\//, '');
  return `/api/logo?path=/uploads/${stripped}`;
};

export const daysLeft = (endDate) => {
  if (!endDate) return 0;
  const diff = new Date(endDate) - new Date();
  return Math.ceil(diff / 86400000);
};

export const subscriptionColor = (days) => {
  if (days <= 0) return 'danger';
  if (days <= 7) return 'warning';
  return 'success';
};

export const storageColor = (pct) => {
  if (pct >= 80) return 'danger';
  if (pct >= 60) return 'warning';
  return 'success';
};

export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const initials = (name = '') =>
  name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

// File type helpers
export const FILE_ICON = { video:'🎬', image:'🖼️', pdf:'📄', presentation:'📊', other:'📎' };
export const getFileIcon = (fileType) => FILE_ICON[fileType] || FILE_ICON.other;

export const isDocType = (fileName) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  return ['pdf','ppt','pptx','doc','docx','xls','xlsx'].includes(ext);
};

export const getDocDuration = (fileName, defaultDur = 50) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (['pdf','ppt','pptx'].includes(ext)) return defaultDur;
  return defaultDur;
};
