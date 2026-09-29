// src/components/ui/Pagination.js
'use client';

export default function Pagination({ page, totalPages, total, pageSize, onPage }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Build page numbers to show (max 7 buttons)
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (page <= 4) {
    pages.push(1,2,3,4,5,'...',totalPages);
  } else if (page >= totalPages - 3) {
    pages.push(1,'...',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
  } else {
    pages.push(1,'...',page-1,page,page+1,'...',totalPages);
  }

  const btn = (label, onClick, active = false, disabled = false) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32, height: 32, padding: '0 8px',
        borderRadius: 'var(--radius-sm)',
        border: active ? 'none' : '1px solid var(--border)',
        background: active ? 'var(--primary)' : disabled ? 'var(--bg-main)' : 'white',
        color: active ? 'white' : disabled ? 'var(--text-muted)' : 'var(--text-body)',
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 16, marginTop: 8,
      borderTop: '1px solid var(--border)',
      flexWrap: 'wrap', gap: 8,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {btn('←', () => onPage(page - 1), false, page === 1)}
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 13 }}>…</span>
            : btn(p, () => onPage(p), p === page)
        )}
        {btn('→', () => onPage(page + 1), false, page === totalPages)}
      </div>
    </div>
  );
}
