// src/app/(admin)/admin/dashboard/page.js
'use client';
import { useQuery } from '@tanstack/react-query';
import { getSubscriptionStatus, getDashboardClient, getActivityLog } from '../../../../lib/api';
import StatCard from '../../../../components/ui/StatCard';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import { fmt } from '../../../../lib/utils';
import { Monitor, Users, GitBranch, FolderOpen, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const ACTION_ICON = {
  upload_file:    { icon:'📤', color:'var(--primary)' },
  delete_file:    { icon:'🗑️',  color:'var(--danger)' },
  publish:        { icon:'📡', color:'var(--success)' },
  unpublish:      { icon:'🔕', color:'var(--warning)' },
  create_user:    { icon:'👤', color:'var(--primary)' },
  delete_user:    { icon:'❌', color:'var(--danger)' },
  create_display: { icon:'📺', color:'var(--primary)' },
  delete_display: { icon:'🗑️',  color:'var(--danger)' },
};

export default function AdminDashboard() {
  const { data }         = useQuery({ queryKey: ['client-dashboard'], queryFn: getDashboardClient, refetchInterval: 30_000 });
  const { data: logData } = useQuery({ queryKey: ['activity-log'], queryFn: () => getActivityLog({ limit: 50 }), refetchInterval: 30_000 });
  const { data: subData  } = useQuery({ queryKey: ['sub-status'], queryFn: getSubscriptionStatus, staleTime: 300000 });
  const sub = subData || {};

  const d = data?.displays || {};
  const u = data?.users    || {};
  const l = data?.lines    || {};
  const m = data?.media    || {};
  const p = data?.published || {};
  const displaysWithContent = data?.displays_with_content || [];
  const logs = logData?.logs || [];

  return (
    <div>
      <div className="page-header">
        <div><h2>Dashboard</h2><p>Your digital signage at a glance</p></div>
      </div>

      {/* FIX: u.total now comes from the backend query that excludes display_ accounts */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', marginBottom:24 }}>
        <StatCard icon={Monitor}     label="Total Displays"    value={d.total||0}           color="primary" />
        <StatCard icon={Monitor}     label="Online Now"        value={d.online||0}           color="success" />
        <StatCard icon={Users}       label="Users / Employees" value={u.total||0}            color="secondary" />
        <StatCard icon={GitBranch}   label="Active Lines"      value={l.active||0}           color="warning" />
        <StatCard icon={FolderOpen}  label="Media Files"       value={m.total_files||0}      color="primary" />
        <StatCard icon={CheckCircle} label="Published Content" value={p.total_published||0}  color="success" />
      </div>

      <div className="two-col" style={{ marginBottom:24 }}>
  
          {/* Subscription + Storage + Displays */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:20, minWidth:0 }}>
            <div style={{ background:sub.is_expired?'#FEF2F2':sub.is_expiring?'#FFF7ED':'white', border:`1px solid ${sub.is_expired?'#FECACA':sub.is_expiring?'#FDE68A':'var(--border)'}`, borderRadius:'var(--radius-lg)', padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase' }}>Subscription</div>
              <div style={{ fontSize:22, fontWeight:800, color:sub.is_expired?'#DC2626':sub.is_expiring?'#D97706':'var(--text-heading)' }}>
                {sub.is_expired ? 'Expired' : sub.days_left != null ? `${sub.days_left}d left` : '—'}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
                {sub.subscription_end ? new Date(sub.subscription_end).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
              </div>
              {(sub.is_expiring||sub.is_expired) && <div style={{ marginTop:6, fontSize:11, fontWeight:700, color:sub.is_expired?'#DC2626':'#D97706' }}>{sub.is_expired?'⚠️ Renew now':'⚠️ Expiring soon'}</div>}
            </div>
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase' }}>Storage</div>
              <div style={{ fontSize:22, fontWeight:800 }}>{sub.used_storage_gb||0} / {sub.total_storage_gb||0} GB</div>
              <div style={{ marginTop:8, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:6, borderRadius:3, background:'var(--primary)', width:`${Math.min(100,((sub.used_storage_gb||0)/(sub.total_storage_gb||1))*100)}%` }}/>
              </div>
            </div>
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase' }}>Displays</div>
              <div style={{ fontSize:22, fontWeight:800 }}>{(data?.displays_with_content||[]).length} / {sub.devices_required||0}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{(sub.devices_required||0)-(data?.displays_with_content||[]).length} slots available</div>
            </div>
          </div>

      <Card title="Displays" subtitle="Live status of all screens"
          action={<Link href="/admin/displays"><Button variant="ghost" size="sm">View all</Button></Link>}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displaysWithContent.slice(0,5).map(disp => (
              <div key={disp.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background: disp.status==='ONLINE'?'var(--success)':'var(--danger)', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text-heading)' }}>{disp.display_name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                    {disp.content_count} files
                    {disp.temperature && <span style={{ marginLeft:8, color:'var(--warning)' }}>🌡 {disp.temperature}</span>}
                  </div>
                </div>
                <Badge variant={disp.status==='ONLINE'?'success':'danger'}>{disp.status}</Badge>
              </div>
            ))}
            {displaysWithContent.length === 0 && (
              <div className="empty"><div className="empty__title">No displays yet</div></div>
            )}
          </div>
        </Card>

        <Card title="Activity Log" subtitle="Recent actions by all users"
          action={<Link href="/admin/activity"><Button variant="ghost" size="sm">View all</Button></Link>}>
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:300, overflowY:'auto' }}>
            {logs.slice(0,15).map(log => {
              const meta = ACTION_ICON[log.action_type] || { icon:'ℹ️', color:'var(--text-muted)' };
              return (
                <div key={log.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:18, flexShrink:0, lineHeight:1, marginTop:2 }}>{meta.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:'var(--text-heading)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <span style={{ fontWeight:700, color: meta.color }}>{log.username}</span>
                      {' · '}
                      <span>{log.detail || log.action_type}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{fmt.ago(log.created_at)}</div>
                  </div>
                </div>
              );
            })}
            {logs.length === 0 && <div className="empty"><div className="empty__title">No activity yet</div></div>}
          </div>
        </Card>
      </div>
    </div>
  );
}