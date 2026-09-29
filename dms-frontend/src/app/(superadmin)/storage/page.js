'use client';
// src/app/(superadmin)/storage/page.js
// FIX: "Used" column and all progress bars now show actual uploaded media
//      (used_media_mb) vs allocated storage (total_storage_gb).
//      The old "used_storage_gb" was a display-device counter, not storage.
import { useQuery } from '@tanstack/react-query';
import { getStorageOverview } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import Card        from '../../../components/ui/Card';
import Badge       from '../../../components/ui/Badge';
import ProgressBar from '../../../components/ui/ProgressBar';
import StatCard    from '../../../components/ui/StatCard';
import Pagination  from '../../../components/ui/Pagination';
import useServerPagination from '../../../hooks/useServerPagination';
import { HardDrive, AlertTriangle } from 'lucide-react';

export default function StoragePage() {
  const { page, setPage, totalPages, total, data } =
    useServerPagination(['storage-overview'], getStorageOverview, { limit: 15 });
  const clients   = data?.clients || [];
  const totals    = data?.totals  || {};
  const alerts    = data?.alerts  || [];

  // Monthly Revenue needs the sum across ALL active clients, not just the
  // visible page — kept as a separate full-set fetch.
  const { data: allData } = useQuery({ queryKey: ['storage-clients-all'], queryFn: () => getStorageOverview({ limit: 500 }) });
  const totalRevenue = (allData?.clients || [])
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + Number(c.pricing || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div><h2>Storage Monitor</h2><p>Media storage usage across all clients</p></div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', marginBottom:24 }}>
        <StatCard icon={HardDrive}     label="Total Allocated"    value={`${totals.total_allocated_gb||0} GB`}  color="primary"/>
        {/* FIX: "Total Used" now shows sum of actual media uploads */}
        <StatCard icon={HardDrive}     label="Total Media Used"   value={fmt.bytes(totals.total_used_media_mb||0)} color="warning"/>
        <StatCard icon={AlertTriangle} label="Over 80% Usage"     value={alerts.length}                         color="danger"/>
        <StatCard icon={HardDrive}     label="Monthly Revenue"    value={`₹${totalRevenue.toLocaleString('en-IN')}`} color="success"/>
      </div>

      {alerts.length > 0 && (
        <div style={{ background:'var(--danger-10)', border:'1px solid var(--danger)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <AlertTriangle size={16} color="var(--danger)"/>
          <span style={{ fontSize:13, color:'var(--danger)', fontWeight:600 }}>
            {alerts.length} client(s) using over 80% of their allocated storage
          </span>
        </div>
      )}

      <Card title="Media Storage by Client"
        subtitle="Total media files uploaded vs allocated storage per company">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th><th>Database</th><th>Displays</th>
                <th>Base Storage</th>
                {/* FIX: "Used" column header clarified */}
                <th>Media Used</th>
                <th>Allocated</th><th>Usage</th>
                <th>Monthly ₹</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const extraGb = Math.max(0, c.total_storage_gb - c.devices_required);
                const baseGb  = c.devices_required;
                return (
                  <tr key={c.id}>
                    <td><div className="table__name">{c.company_name}</div></td>
                    <td><code style={{ fontSize:11 }}>{c.database_name}</code></td>
                    <td style={{ textAlign:'center', fontWeight:600 }}>{c.devices_required}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                      {baseGb} GB base
                      {extraGb > 0 && <span style={{ color:'var(--warning)', marginLeft:4 }}>+{extraGb} extra</span>}
                    </td>
                    {/* FIX: show actual uploaded media size */}
                    <td style={{ fontWeight:600 }}>{fmt.bytes(c.used_media_mb || 0)}</td>
                    <td>{c.total_storage_gb} GB</td>
                    <td style={{ minWidth:160 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1 }}>
                          <ProgressBar value={c.usage_pct||0} size="sm"/>
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, minWidth:40 }}>
                          {c.usage_pct||0}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight:700, color:'var(--success)', fontSize:13 }}>
                      ₹{Number(c.pricing||0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <Badge variant={c.is_active?'success':'danger'}>
                        {c.is_active?'Active':'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr><td colSpan={9}>
                  <div className="empty"><div className="empty__title">No clients yet</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />
      </Card>
    </div>
  );
}
