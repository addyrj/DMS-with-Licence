'use client';
// src/app/(superadmin)/dashboard/page.js
// FIX: all storage numbers now come from used_media_mb (actual uploads)
//      instead of used_storage_gb (display-device counter).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardSystem, getStorageOverview } from '../../../lib/api';
import { fmt, daysLeft, subscriptionColor } from '../../../lib/utils';
import Card        from '../../../components/ui/Card';
import Badge       from '../../../components/ui/Badge';
import ProgressBar from '../../../components/ui/ProgressBar';
import Button      from '../../../components/ui/Button';
import Modal       from '../../../components/ui/Modal';
import { AlertTriangle, CheckCircle, Users, HardDrive, TrendingUp } from 'lucide-react';
import Link from 'next/link';

function ColorCard({ title, value, subtitle, gradient, icon, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        background: gradient, borderRadius:'var(--radius-lg)', padding:'28px 24px',
        color:'white', position:'relative', overflow:'hidden',
        boxShadow:'0 8px 24px rgba(0,0,0,.15)',
        cursor: onClick ? 'pointer' : 'default',
        transition:'transform .18s, box-shadow .18s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,.2)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.15)'; }}
    >
      <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.12)' }} />
      <div style={{ position:'absolute', right:30, bottom:-30, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.08)' }} />
      <div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,.25)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
        {icon}
      </div>
      <div style={{ fontSize:15, fontWeight:600, opacity:.9, marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:32, fontWeight:800, lineHeight:1, marginBottom:8 }}>{value}</div>
      {subtitle && <div style={{ fontSize:13, opacity:.85, fontWeight:500 }}>{subtitle}</div>}
      {onClick && <div style={{ fontSize:11, opacity:.7, marginTop:8 }}>Click to view details →</div>}
    </div>
  );
}

export default function SADashboard() {
  const { data: dash }    = useQuery({ queryKey:['sa-dashboard'],     queryFn: getDashboardSystem, refetchInterval: 60_000 });
  const { data: storage } = useQuery({ queryKey:['storage-overview'], queryFn: getStorageOverview, refetchInterval: 60_000 });

  const [revenueModal, setRevenueModal] = useState(false);

  const s              = dash?.stats         || {};
  const clients        = dash?.recent_clients || [];
  const expiring       = dash?.expiring_soon  || [];
  const storageClients = storage?.clients     || [];
  const revenueData    = dash?.revenue_breakdown || [];

  // FIX: use used_media_gb from backend (actual uploads), not used_storage_gb
  const usedMediaGb  = Number(s.used_media_gb  || 0);
  const totalStorage = Number(s.total_storage_gb || 0);
  const usedPct      = totalStorage > 0 ? Math.round((usedMediaGb / totalStorage) * 100) : 0;

  const monthlyRevenue = Number(s.monthly_revenue || 0);
  const totalRevenue   = Number(s.total_contracted_revenue || 0);

  return (
    <div>
      <div className="page-header">
        <div><h2>System Overview</h2><p>All clients and system health at a glance</p></div>
        <Link href="/clients/new"><Button variant="primary">+ New Client</Button></Link>
      </div>

      {expiring.length > 0 && (
        <div style={{ background:'var(--danger-10)', border:'1px solid var(--danger)', borderRadius:'var(--radius-md)', padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
          <AlertTriangle size={20} color="var(--danger)" />
          <span style={{ fontWeight:700, color:'var(--danger)', fontSize:14 }}>
            🚨 {expiring.length} subscription{expiring.length>1?'s':''} expiring within 7 days
          </span>
          <Link href="/clients" style={{ marginLeft:'auto' }}>
            <Button variant="danger" size="sm">View All</Button>
          </Link>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:20, marginBottom:28 }}>
        <ColorCard title="Total Clients"  value={s.total_clients||0}  subtitle={`${s.active_clients||0} active`}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" icon={<Users size={22} color="white"/>} />
        <ColorCard title="Active Clients" value={s.active_clients||0} subtitle={`${s.inactive_clients||0} inactive`}
          gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" icon={<CheckCircle size={22} color="white"/>} />
        <ColorCard title="Expiring Soon"  value={s.expiring_soon||0}  subtitle="Within 7 days"
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" icon={<AlertTriangle size={22} color="white"/>} />
        {/* FIX: subtitle shows used_media_gb (real uploads) not used_storage_gb */}
        <ColorCard title="Total Storage"
          value={`${totalStorage} GB`}
          subtitle={`${fmt.bytes(usedMediaGb * 1024)} media used (${usedPct}%)`}
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          icon={<HardDrive size={22} color="white"/>} />
        <ColorCard
          title="Monthly Revenue"
          value={`₹${monthlyRevenue.toLocaleString('en-IN')}`}
          subtitle={`${s.active_clients||0} active clients`}
          gradient="linear-gradient(135deg, #f7971e 0%, #ffd200 100%)"
          icon={<TrendingUp size={22} color="white"/>}
          onClick={() => setRevenueModal(true)}
        />
      </div>

      <div className="two-col" style={{ marginBottom:24 }}>
        <Card title="Expiring Soon" subtitle="Subscriptions ending within 7 days"
          action={<Link href="/clients"><Button variant="ghost" size="sm">View all</Button></Link>}>
          {expiring.length === 0 ? (
            <div className="empty"><div style={{ fontSize:32, marginBottom:8 }}>✅</div><div className="empty__title">All subscriptions healthy</div></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Client</th><th>Ends</th><th>Days</th></tr></thead>
                <tbody>
                  {expiring.map(c => {
                    const d = daysLeft(c.subscription_end);
                    return (
                      <tr key={c.id}>
                        <td><div className="table__name">{c.company_name}</div></td>
                        <td style={{ fontSize:13 }}>{fmt.date(c.subscription_end)}</td>
                        <td><Badge variant={subscriptionColor(d)}>{d === 0 ? 'Today!' : `${d}d left`}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* FIX: storage bars now use used_media_mb from the storage overview */}
        <Card title="Storage Usage" subtitle="Actual uploaded media vs allocated per client"
          action={<Link href="/storage"><Button variant="ghost" size="sm">View all</Button></Link>}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {storageClients.slice(0,5).map(c => {
              const usedMb  = Number(c.used_media_mb || 0);
              const limitGb = c.total_storage_gb || 1;
              const pct     = Number(c.usage_pct || 0);
              return (
                <div key={c.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
                    <span style={{ fontWeight:600, color:'var(--text-heading)' }}>{c.company_name}</span>
                    {/* FIX: show actual media used vs GB allocated */}
                    <span style={{ color:'var(--text-muted)' }}>{fmt.bytes(usedMb)} / {limitGb} GB</span>
                  </div>
                  <ProgressBar value={pct} max={100} size="sm" />
                </div>
              );
            })}
            {storageClients.length === 0 && <div className="empty"><div className="empty__title">No clients yet</div></div>}
          </div>
        </Card>
      </div>

      <Card title="Recent Clients">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Company</th><th>Media Storage</th><th>Subscription</th><th>Monthly</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {clients.map(c => {
                const d     = daysLeft(c.subscription_end);
                const usedMb = Number(c.used_media_mb || 0);
                return (
                  <tr key={c.id}>
                    <td><div className="table__name">{c.company_name}</div></td>
                    {/* FIX: actual media used */}
                    <td style={{ fontSize:13 }}>{fmt.bytes(usedMb)} / {c.total_storage_gb} GB</td>
                    <td><Badge variant={subscriptionColor(d)}>{d > 0 ? `${d}d left` : 'Expired'}</Badge></td>
                    <td style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>₹{Number(c.pricing||0).toLocaleString('en-IN')}</td>
                    <td><Badge variant={c.is_active?'success':'danger'} dot>{c.is_active?'Active':'Inactive'}</Badge></td>
                    <td><Link href={`/clients/${c.id}`}><Button variant="ghost" size="sm">View</Button></Link></td>
                  </tr>
                );
              })}
              {clients.length === 0 && <tr><td colSpan={6}><div className="empty"><div className="empty__title">No clients yet</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Revenue modal */}
      <Modal open={revenueModal} onClose={() => setRevenueModal(false)} title="Revenue Breakdown" size="lg">
        <div style={{ marginBottom:20, display:'flex', gap:20 }}>
          <div style={{ background:'var(--success-10)', borderRadius:'var(--radius-md)', padding:'16px 24px', flex:1, textAlign:'center' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Monthly Active Revenue</div>
            <div style={{ fontSize:28, fontWeight:800, color:'var(--success)' }}>₹{monthlyRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ background:'var(--primary-10)', borderRadius:'var(--radius-md)', padding:'16px 24px', flex:1, textAlign:'center' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Total Contracted</div>
            <div style={{ fontSize:28, fontWeight:800, color:'var(--primary)' }}>₹{totalRevenue.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Company</th><th>Plan ₹/mo</th><th>Days Active</th><th>Subscription End</th><th>Days Left</th><th>Status</th></tr></thead>
            <tbody>
              {revenueData.map(c => {
                const d = daysLeft(c.subscription_end);
                return (
                  <tr key={c.id}>
                    <td><div className="table__name">{c.company_name}</div></td>
                    <td style={{ fontWeight:700, color:'var(--success)' }}>₹{Number(c.pricing||0).toLocaleString('en-IN')}</td>
                    <td style={{ fontSize:13 }}>{c.days_active || 0}d</td>
                    <td style={{ fontSize:13 }}>{fmt.date(c.subscription_end)}</td>
                    <td><Badge variant={subscriptionColor(d)}>{d > 0 ? `${d}d` : 'Expired'}</Badge></td>
                    <td><Badge variant={c.is_active?'success':'danger'} dot>{c.is_active?'Active':'Inactive'}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
