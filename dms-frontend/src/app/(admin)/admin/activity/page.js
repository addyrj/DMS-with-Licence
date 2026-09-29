// src/app/(admin)/admin/activity/page.js
'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useServerPagination from '../../../../hooks/useServerPagination';
import { getActivityLog } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Pagination from '../../../../components/ui/Pagination';

const ACTION_META = {
  upload_file:    { icon:'📤', label:'Upload',        variant:'primary' },
  delete_file:    { icon:'🗑️', label:'Delete File',   variant:'danger'  },
  delete_folder:  { icon:'📁', label:'Delete Folder', variant:'danger'  },
  publish:        { icon:'📡', label:'Publish',       variant:'success' },
  unpublish:      { icon:'🔕', label:'Unpublish',     variant:'warning' },
  create_user:    { icon:'👤', label:'Create User',   variant:'primary' },
  delete_user:    { icon:'❌', label:'Delete User',   variant:'danger'  },
  create_display: { icon:'📺', label:'Add Display',   variant:'primary' },
  delete_display: { icon:'🗑️', label:'Del Display',  variant:'danger'  },
  create_line:    { icon:'🔗', label:'Create Line',   variant:'primary' },
  delete_line:    { icon:'❌', label:'Delete Line',   variant:'danger'  },
};

const ACTION_TYPES = ['all', ...Object.keys(ACTION_META)];

export default function ActivityPage() {
  const qc = useQueryClient();
  const [filter, setFilter]         = useState('all');
  const [searchText, setSearchText] = useState('');
  const PAGE_SIZE = 25;

  // Stats row needs totals across ALL entries, not just the visible page —
  // kept as a separate bounded fetch (same 1000-row cap this page used before).
  const { data: statsData } = useQuery({
    queryKey:        ['activity-log-stats'],
    queryFn:         () => getActivityLog({ limit: 1000 }),
    refetchInterval: 30_000,
  });
  const statLogs = statsData?.logs || [];

  const {
    data, isLoading, page, setPage, totalPages, total, setSearchInput, refetch,
  } = useServerPagination(
    ['activity-log', filter],
    (params) => getActivityLog({ ...params, type: filter === 'all' ? undefined : filter }),
    { limit: PAGE_SIZE }
  );
  const logs = data?.logs || [];

  const handleFilter = (f) => { setFilter(f); setPage(1); };
  const handleSearch = (v) => { setSearchText(v); setSearchInput(v); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Activity Log</h2>
          <p>Full audit trail of all user actions</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>🔄 Refresh</Button>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Actions', value: statLogs.length,                                         color:'var(--primary)' },
          { label:'Uploads',       value: statLogs.filter(l => l.action_type==='upload_file').length, color:'var(--primary)' },
          { label:'Publishes',     value: statLogs.filter(l => l.action_type==='publish').length,     color:'var(--success)' },
          { label:'Deletions',     value: statLogs.filter(l => l.action_type?.startsWith('delete')).length, color:'var(--danger)' },
        ].map(s => (
          <div key={s.label} style={{ background:'white', borderRadius:'var(--radius-md)',
            padding:'14px 18px', boxShadow:'var(--shadow-sm)', textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card>
        {/* Search + filter */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
          <input className="input" placeholder="Search by user or action..."
            value={searchText} onChange={e => handleSearch(e.target.value)}
            style={{ flex:1, minWidth:200 }}/>

          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {ACTION_TYPES.map(t => {
              const meta = ACTION_META[t];
              return (
                <button key={t} onClick={() => handleFilter(t)}
                  style={{
                    padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600,
                    cursor:'pointer', border:'1px solid var(--border)',
                    background: filter===t ? 'var(--primary)' : 'white',
                    color:      filter===t ? 'white' : 'var(--text-body)',
                    transition: 'all .15s',
                  }}>
                  {meta ? `${meta.icon} ${meta.label}` : 'All'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
          {total} {total===1 ? 'entry' : 'entries'} found
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(5)].map((_,i) => (
                <tr key={i}><td colSpan={4}><div className="skeleton" style={{height:20}}/></td></tr>
              ))}
              {logs.map((log, i) => {
                const meta = ACTION_META[log.action_type] || { icon:'•', label:log.action_type, variant:'muted' };
                return (
                  <tr key={log.id || i}>
                    <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {fmt.dateTime ? fmt.dateTime(log.created_at) : log.created_at}
                    </td>
                    <td>
                      <div style={{ fontWeight:600, fontSize:13 }}>{log.username || '—'}</div>
                    </td>
                    <td>
                      <Badge variant={meta.variant}>
                        {meta.icon} {meta.label}
                      </Badge>
                    </td>
                    <td style={{ fontSize:13, color:'var(--text-body)', maxWidth:320,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {log.detail || '—'}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && logs.length === 0 && (
                <tr><td colSpan={4}>
                  <div className="empty">
                    <div className="empty__icon">📋</div>
                    <div className="empty__title">{searchText || filter !== 'all' ? 'No matching entries' : 'No activity yet'}</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </Card>
    </div>
  );
}
