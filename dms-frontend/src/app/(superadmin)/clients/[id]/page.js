'use client';
// src/app/(superadmin)/clients/[id]/page.js
// FIXES:
// - SA CANNOT delete individual users or displays (service provider policy)
// - Users tab filters out display_ accounts (shows employees only)
// - Production line names shown in users tab
// - Per-display storage shown in displays tab
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClient, getClientDisplays, getClientUsers, getClientStorage, getClientPaymentHistory,
  getSubscriptionLogs, getClientLines, resetClientAdminPassword,
} from '../../../../lib/api';
import { fmt, daysLeft, subscriptionColor } from '../../../../lib/utils';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ProgressBar from '../../../../components/ui/ProgressBar';
import Pagination from '../../../../components/ui/Pagination';
import useServerPagination from '../../../../hooks/useServerPagination';
import { Field, Input } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import ClientEditModal from '../../../../components/clients/ClientEditModal';
import { ArrowLeft, Edit, KeyRound, GitBranch, HardDrive } from 'lucide-react';

const TABS = ['Overview', 'Displays', 'Users', 'Storage', 'Subscription Logs', 'Payment History'];

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast  = useToast();
  const qc     = useQueryClient();

  const [tab, setTab]         = useState('Overview');
  const [editModal, setEdit]  = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [newPw, setNewPw]     = useState('');

  const { data: clientData, refetch: refetchClient } = useQuery({ queryKey: ['client', id], queryFn: () => getClient(id) });
  const { data: linesData   } = useQuery({ queryKey: ['client-lines',   id], queryFn: () => getClientLines(id),        enabled: tab === 'Overview' });

  const dispPager = useServerPagination(['client-displays', id], (p) => getClientDisplays(id, p), { limit: 15, enabled: tab === 'Displays' });
  const dispData  = dispPager.data;

  // Users tab shows employee-vs-display-account counts that must reflect the
  // client's FULL user set, not just the visible page — kept as a separate fetch.
  const { data: usersAllData } = useQuery({ queryKey: ['client-users-all', id], queryFn: () => getClientUsers(id, { limit: 500 }), enabled: tab === 'Users' });
  const usersPager = useServerPagination(['client-users', id], (p) => getClientUsers(id, p), { limit: 15, enabled: tab === 'Users' });
  const usersData  = usersPager.data;

  const storagePager = useServerPagination(['client-storage', id], (p) => getClientStorage(id, p), { limit: 15, enabled: tab === 'Storage' });
  const storageData  = storagePager.data;

  const logsPager = useServerPagination(['client-logs', id], (p) => getSubscriptionLogs(id, p), { limit: 15, enabled: tab === 'Subscription Logs' });
  const logsData  = logsPager.data;

  const payPager = useServerPagination(['client-payments', id], (p) => getClientPaymentHistory(id, p), { limit: 15, enabled: tab === 'Payment History' });
  const payData  = payPager.data;

  const client     = clientData?.client;
  const lines      = linesData?.lines      || [];
  const unassigned = linesData?.unassigned || [];

  const pwMut = useMutation({
    mutationFn: () => resetClientAdminPassword(id, { new_password: newPw }),
    onSuccess: () => { setPwModal(false); setNewPw(''); toast('Admin password reset'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  if (!client) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div className="spinner spinner--lg" style={{ margin:'0 auto' }} />
    </div>
  );

  const d = daysLeft(client.subscription_end);

  // Filter users: exclude display_ accounts (SA sees employees only).
  // Counts come from the full-set fetch; the table renders the current page only.
  const allUsers       = usersAllData?.users || [];
  const employeeCount  = allUsers.filter(u => !u.username?.startsWith('display_')).length;
  const displayCount   = allUsers.filter(u => u.username?.startsWith('display_')).length;
  const employeeUsers  = (usersData?.users || []).filter(u => !u.username?.startsWith('display_'));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
            <ArrowLeft size={16}/>
          </Button>
          <div>
            <h2>{client.company_name}</h2>
            <p>{client.admin_username} · {client.contact_phone || '—'}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Edit size={14}/> Edit
          </Button>
          <Button variant="secondary" onClick={() => setPwModal(true)}>
            <KeyRound size={14}/> Reset Password
          </Button>
          <Badge variant={client.is_active ? 'success' : 'danger'} dot>
            {client.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--border)', marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding:'10px 16px', fontSize:14, fontWeight:600,
              cursor:'pointer', border:'none', background:'none',
              color: tab===t ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab===t ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom:-1,
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14 }}>
            {[
              { label:'Displays',    value: client.devices_required },
              { label:'Storage',     value: `${client.total_storage_gb} GB` },
              { label:'Subscription', value: <Badge variant={subscriptionColor(d)}>{d < 0 ? 'Expired' : `${d}d left`}</Badge> },
              { label:'Monthly Price', value: `₹${Number(client.pricing||0).toLocaleString('en-IN')}`, color:'var(--success)' },
            ].map(item => (
              <div key={item.label} style={{ background:'white', borderRadius:'var(--radius-lg)', padding:'16px 18px', boxShadow:'var(--shadow-sm)' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:6 }}>{item.label}</div>
                <div style={{ fontSize:item.color?20:22, fontWeight:800, color: item.color||'var(--text-heading)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <Card title="Production Lines" subtitle="Each line and its displays">
            {lines.length === 0 ? (
              <div className="empty"><div className="empty__icon">🔗</div><div className="empty__title">No production lines yet</div></div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {lines.map(line => (
                  <div key={line.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--bg-main)' }}>
                      <GitBranch size={16} color="var(--primary)"/>
                      <span style={{ fontWeight:700, fontSize:14, flex:1 }}>{line.production_line_name}</span>
                      <Badge variant={line.active_line ? 'success' : 'muted'}>{line.active_line ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    {line.displays?.length ? (
                      <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:6 }}>
                        {line.displays.map(d2 => (
                          <div key={d2.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:'var(--radius-sm)', background:'white', border:'1px solid var(--border)' }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background: d2.status==='ONLINE' ? 'var(--success)' : 'var(--danger)', flexShrink:0 }} />
                            <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{d2.display_name}</span>
                            <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d2.display_number}</code>
                            {/* SA cannot delete displays — read only view */}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding:'14px 16px', fontSize:13, color:'var(--text-muted)' }}>No displays attached</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {unassigned.length > 0 && (
            <Card title="Unassigned Displays">
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {unassigned.map(d2 => (
                  <div key={d2.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:'var(--radius-sm)', background:'var(--bg-main)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: d2.status==='ONLINE' ? 'var(--success)' : 'var(--danger)', flexShrink:0 }} />
                    <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{d2.display_name}</span>
                    <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d2.display_number}</code>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Displays — FIX: shows per-display storage, NO delete button */}
      {tab === 'Displays' && (
        <Card>
          <div style={{ marginBottom:14, fontSize:13, color:'var(--text-muted)' }}>
            ℹ️ As a service provider, you can view but not delete individual display accounts. Contact the client admin for internal changes.
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Display</th>
                  <th>Status</th>
                  <th>Content Storage</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {(dispData?.displays || []).map(d2 => (
                  <tr key={d2.id}>
                    <td>
                      <div className="table__name">{d2.display_name}</div>
                      <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d2.display_number}</code>
                    </td>
                    <td><Badge variant={d2.status==='ONLINE'?'success':'danger'} dot>{d2.status}</Badge></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <HardDrive size={13} color="var(--primary)"/>
                        <span style={{ fontSize:13 }}>{fmt.bytes(d2.media_storage_mb || 0)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(d2.last_heartbeat)}</td>
                  </tr>
                ))}
                {!(dispData?.displays?.length) && (
                  <tr><td colSpan={4}><div className="empty"><div className="empty__title">No displays yet</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={dispPager.page} totalPages={dispPager.totalPages} total={dispPager.total} pageSize={15} onPage={dispPager.setPage} />
        </Card>
      )}

      {/* Users — FIX: employees only, NO delete button, display_ accounts in separate count */}
      {tab === 'Users' && (
        <Card>
          <div style={{ marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              {employeeCount} employee{employeeCount!==1?'s':''} · {displayCount} display account{displayCount!==1?'s':''}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>
              ℹ️ Read-only — client manages their own users
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Username</th><th>Email</th><th>Production Line</th><th>Status</th></tr>
              </thead>
              <tbody>
                {employeeUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="table__name">{u.username}</div>
                      {u.username === client.admin_username && (
                        <Badge variant="primary" style={{ marginTop:4 }}>Admin</Badge>
                      )}
                    </td>
                    <td style={{ fontSize:13 }}>{u.email || '—'}</td>
                    <td style={{ fontSize:13 }}>{u.production_line_name || '—'}</td>
                    <td><Badge variant={u.is_active?'success':'danger'} dot>{u.is_active?'Active':'Inactive'}</Badge></td>
                  </tr>
                ))}
                {employeeUsers.length === 0 && (
                  <tr><td colSpan={4}><div className="empty"><div className="empty__title">No employee users yet</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={usersPager.page} totalPages={usersPager.totalPages} total={usersPager.total} pageSize={15} onPage={usersPager.setPage} />
        </Card>
      )}

      {/* Storage */}
      {tab === 'Storage' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:20 }}>
            {[
              { label:'Total Allocated',    value:`${client.total_storage_gb} GB`,                            color:'var(--text-heading)' },
              { label:'Used Media Storage', value: fmt.bytes(storageData?.summary?.media_mb || 0),            color:'var(--primary)' },
              { label:'Usage',              value:`${storageData?.summary?.usage_pct || 0}%`,
                color:(storageData?.summary?.usage_pct||0) > 80 ? 'var(--danger)' : 'var(--success)' },
            ].map(item => (
              <div key={item.label} style={{ background:'white', borderRadius:'var(--radius-lg)', padding:'20px', boxShadow:'var(--shadow-sm)', textAlign:'center' }}>
                <div style={{ fontSize:30, fontWeight:800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, marginTop:4 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:20 }}>
            <ProgressBar value={storageData?.summary?.usage_pct || 0} size="md" />
          </div>
          <Card title="Folders">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Folder</th><th>Files</th><th>Size</th></tr></thead>
                <tbody>
                  {(storageData?.folders || []).map(f => (
                    <tr key={f.folder_name}>
                      <td><div className="table__name">{f.folder_name}</div></td>
                      <td>{f.file_count}</td>
                      <td>{fmt.bytes(f.total_mb || 0)}</td>
                    </tr>
                  ))}
                  {!(storageData?.folders?.length) && (
                    <tr><td colSpan={3}><div className="empty"><div className="empty__title">No folders yet</div></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={storagePager.page} totalPages={storagePager.totalPages} total={storagePager.total} pageSize={15} onPage={storagePager.setPage} />
          </Card>
        </div>
      )}

      {/* Subscription Logs */}
      {tab === 'Subscription Logs' && (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Action</th><th>Plan</th><th>Old End</th><th>New End</th><th>When</th></tr></thead>
              <tbody>
                {(logsData?.logs || []).map(l => (
                  <tr key={l.id}>
                    <td><Badge variant="primary">{l.action}</Badge></td>
                    <td>{l.plan_days ? `${l.plan_days}d` : '—'}</td>
                    <td style={{ fontSize:12 }}>{l.old_end_date ? fmt.date(l.old_end_date) : '—'}</td>
                    <td style={{ fontSize:12 }}>{l.new_end_date ? fmt.date(l.new_end_date) : '—'}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(l.created_at)}</td>
                  </tr>
                ))}
                {!(logsData?.logs?.length) && (
                  <tr><td colSpan={5}><div className="empty"><div className="empty__title">No logs yet</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={logsPager.page} totalPages={logsPager.totalPages} total={logsPager.total} pageSize={15} onPage={logsPager.setPage} />
        </Card>
      )}


      {tab === 'Payment History' && (
        <div>
          {payData && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:20}}>
              <div style={{background:'white',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase'}}>Total Paid</div>
                <div style={{fontSize:24,fontWeight:800,color:'var(--primary)'}}>&#8377;{(payData.total_paid_inr||0).toLocaleString('en-IN')}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{payData.paid_count||0} transactions</div>
              </div>
              <div style={{background:'white',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase'}}>Pending</div>
                <div style={{fontSize:24,fontWeight:800,color:'#D97706'}}>{payData.pending_count||0}</div>
              </div>
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Payment ID</th><th>Status</th></tr></thead>
              <tbody>
                {(payData?.history||[]).map(p=>{
                  const meta=p.meta?JSON.parse(p.meta):{};
                  const amt=Math.round((p.amount_paise||0)/100);
                  return(
                    <tr key={p.id}>
                      <td style={{fontSize:13}}>{new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{fontSize:13,fontWeight:600}}>{p.payment_type==='display'?'Displays':p.payment_type==='storage'?'Storage':'Subscription'}</td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{meta.description||'—'}</td>
                      <td style={{fontSize:13,fontWeight:700,color:'var(--primary)'}}>&#8377;{amt.toLocaleString('en-IN')}</td>
                      <td style={{fontSize:11,color:'var(--text-muted)',fontFamily:'monospace'}}>{p.razorpay_payment_id||'—'}</td>
                      <td><span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,
                        background:p.status==='paid'?'#D1FAE5':p.status==='failed'?'#FEE2E2':'#FEF3C7',
                        color:p.status==='paid'?'#065F46':p.status==='failed'?'#991B1B':'#92400E'}}>
                        {p.status==='paid'?'Paid':p.status==='failed'?'Failed':'Pending'}
                      </span></td>
                    </tr>
                  );
                })}
                {!(payData?.history?.length)&&<tr><td colSpan={6}><div className="empty"><div className="empty__icon">💳</div><div className="empty__title">No payment history</div></div></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={payPager.page} totalPages={payPager.totalPages} total={payPager.total} pageSize={15} onPage={payPager.setPage} />
        </div>
      )}

      {/* Modals */}
      <ClientEditModal client={client} open={editModal} onClose={() => setEdit(false)} onSaved={refetchClient} />

      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Reset Admin Password" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setPwModal(false)}>Cancel</Button>
          <Button variant="primary" loading={pwMut.isPending} onClick={() => pwMut.mutate()}>Update</Button>
        </>}>
        <Field label="New Password (min 8 chars)">
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password"/>
        </Field>
      </Modal>
    </div>
  );
}
