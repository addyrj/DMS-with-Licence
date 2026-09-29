'use client';
// src/app/(superadmin)/clients/page.js
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClients, deleteClient, toggleClientStatus, upgradeStorage,
         changeSubscription, upgradeDisplays } from '../../../lib/api';
import { fmt, daysLeft, subscriptionColor } from '../../../lib/utils';
import Card         from '../../../components/ui/Card';
import Badge        from '../../../components/ui/Badge';
import Button       from '../../../components/ui/Button';
import Modal        from '../../../components/ui/Modal';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import ProgressBar  from '../../../components/ui/ProgressBar';
import { Field, Input, Select } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import ClientEditModal from '../../../components/clients/ClientEditModal';
import { Plus, Trash2, HardDrive, Calendar, AlertTriangle, Edit, Monitor } from 'lucide-react';
import useServerPagination from '../../../hooks/useServerPagination';
import Pagination from '../../../components/ui/Pagination';
import Link from 'next/link';

export default function ClientsPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => { qc.invalidateQueries({ queryKey: ['clients'] }); qc.invalidateQueries({ queryKey: ['clients-all'] }); };

  // The "expiring soon" banner and the active-count in the header need the
  // FULL client set, not just the visible page — kept as a separate fetch.
  const { data: allData } = useQuery({ queryKey: ['clients-all'], queryFn: () => getClients({ limit: 500 }) });
  const allClients = allData?.clients || [];

  const { data, isLoading, page, setPage, total, totalPages } =
    useServerPagination(['clients'], getClients, { limit: 15 });
  const clients = data?.clients || [];

  const [storageModal,  setStorageModal]  = useState(null);
  const [planModal,     setPlanModal]     = useState(null);
  const [deleteModal,   setDeleteModal]   = useState(null);
  const [editModal,     setEditModal]     = useState(null);
  const [displaysModal, setDisplaysModal] = useState(null);

  const [addGb,       setAddGb]       = useState('1');
  const [planDays,    setPlanDays]    = useState('30');
  const [addDisplays, setAddDisplays] = useState('1');

  const addDisplaysNum     = Number(addDisplays) || 0;
  const dispClient         = displaysModal;
  const dispCurrentDevices = dispClient?.devices_required || 0;
  const dispCurrentStorage = dispClient?.total_storage_gb || 0;
  const dispCurrentPrice   = Number(dispClient?.pricing || 0);
  const dispPerGbRate      = dispCurrentStorage > 0 ? dispCurrentPrice / dispCurrentStorage : 200;
  const dispNewDevices     = dispCurrentDevices + addDisplaysNum;
  const dispNewStorage     = dispCurrentStorage + addDisplaysNum;
  const dispNewPrice       = Math.round(dispPerGbRate * dispNewStorage);
  const dispPriceIncrease  = dispNewPrice - dispCurrentPrice;

  const addGbNum       = Number(addGb) || 0;
  const storageClient  = storageModal;
  const currentStorage = storageClient?.total_storage_gb || 0;
  const oldPrice       = Number(storageClient?.pricing || 0);
  const perGbRate      = currentStorage > 0 ? oldPrice / currentStorage : 200;
  const addedCost      = perGbRate * addGbNum;
  const newPrice       = oldPrice + addedCost;

  const deleteMut = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => { inv(); setDeleteModal(null); toast('Client deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const toggleMut = useMutation({
    mutationFn: (id) => toggleClientStatus(id),
    onSuccess: inv,
    onError:   (e) => toast(e.message, 'danger'),
  });
  const storageMut = useMutation({
    mutationFn: ({ id, gb }) => upgradeStorage(id, { additional_gb: Number(gb) }),
    onSuccess: () => { inv(); setStorageModal(null); toast('Storage upgraded!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const planMut = useMutation({
    mutationFn: ({ id, days }) => changeSubscription(id, { days: Number(days) }),
    onSuccess: () => { inv(); setPlanModal(null); toast('Subscription renewed!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });
  const displaysMut = useMutation({
    mutationFn: ({ id, additional }) => upgradeDisplays(id, { additional_displays: Number(additional) }),
    onSuccess: () => { inv(); setDisplaysModal(null); toast('Displays upgraded!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const expiring = allClients.filter(c => {
    const d = daysLeft(c.subscription_end);
    return d >= 0 && d <= 7 && c.is_active;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Clients</h2>
          <p>{total} total · {allClients.filter(c=>c.is_active).length} active</p>
        </div>
        <Link href="/clients/new">
          <Button variant="primary"><Plus size={16}/>New Client</Button>
        </Link>
      </div>

      {expiring.length > 0 && (
        <div style={{ background:'var(--warning-10)', border:'1px solid var(--warning)', borderRadius:'var(--radius-md)', padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'flex-start', gap:12 }}>
          <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink:0, marginTop:2 }}/>
          <div>
            <div style={{ fontWeight:700, color:'var(--warning)', marginBottom:6 }}>
              ⚠️ {expiring.length} subscription{expiring.length>1?'s':''} expiring within 7 days
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {expiring.map(c => {
                const d = daysLeft(c.subscription_end);
                return (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', background:'white', borderRadius:99, fontSize:13 }}>
                    <span style={{ fontWeight:600 }}>{c.company_name}</span>
                    <Badge variant={d<=2?'danger':'warning'}>{d===0?'Today!':`${d}d left`}</Badge>
                    <button onClick={() => { setPlanModal(c); setPlanDays('30'); }}
                      style={{ fontSize:11, color:'var(--primary)', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>
                      Renew →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th><th>Admin</th><th>Displays</th>
                {/* FIX: header clarified — this is media content, not device slots */}
                <th>Media Storage</th>
                <th>Monthly</th><th>Subscription</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(3)].map((_,i) => (
                <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height:20 }}/></td></tr>
              ))}
              {clients.map(c => {
                const d = daysLeft(c.subscription_end);
                // FIX: use used_media_mb vs total_storage_gb (in MB) for storage display
                const usedMb  = Number(c.used_media_mb || 0);
                const limitMb = (c.total_storage_gb || 1) * 1024;
                const pct     = Math.min(100, Math.round((usedMb / limitMb) * 100));
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} style={{ textDecoration:'none' }}>
                        <div className="table__name" style={{ color:'var(--primary)' }}>{c.company_name}</div>
                        <div className="table__sub">{c.database_name}</div>
                      </Link>
                    </td>
                    <td style={{ fontSize:13 }}>{c.admin_username}</td>
                    <td>
                      <button onClick={() => setEditModal(c)}
                        style={{ background:'var(--primary-10)', border:'1px solid var(--primary)', borderRadius:6, padding:'3px 10px', fontSize:13, fontWeight:700, color:'var(--primary)', cursor:'pointer' }}>
                        {c.devices_required}
                      </button>
                    </td>
                    {/* FIX: media storage column — shows actual uploaded size, not display count */}
                    <td style={{ minWidth:160 }}>
                      <div style={{ fontSize:12, marginBottom:4, color:'var(--text-muted)' }}>
                        {fmt.bytes(usedMb)} / {c.total_storage_gb} GB
                      </div>
                      <ProgressBar value={pct} size="sm"/>
                    </td>
                    <td style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>
                      ₹{Number(c.pricing||0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <Badge variant={subscriptionColor(d)}>
                        {d < 0 ? 'Expired' : d===0 ? 'Today!' : `${d}d left`}
                      </Badge>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{fmt.date(c.subscription_end)}</div>
                    </td>
                    <td>
                      <Badge variant={c.is_active?'success':'danger'} dot>
                        {c.is_active?'Active':'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <button onClick={() => toggleMut.mutate(c.id)}
                          style={{ padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid var(--border)',
                            background: c.is_active ? 'var(--warning-10)' : 'var(--success-10)',
                            color: c.is_active ? 'var(--warning)' : 'var(--success)' }}>
                          {c.is_active ? 'OFF' : 'ON'}
                        </button>
                        <button title="Full edit" onClick={() => setEditModal(c)}
                          style={{ padding:6, borderRadius:6, cursor:'pointer', border:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center' }}>
                          <Edit size={13} color="var(--text-muted)"/>
                        </button>
                        <button title="Upgrade displays" onClick={() => { setDisplaysModal(c); setAddDisplays('1'); }}
                          style={{ padding:6, borderRadius:6, cursor:'pointer', border:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center' }}>
                          <Monitor size={13} color="var(--primary)"/>
                        </button>
                        <button title="Upgrade storage" onClick={() => { setStorageModal(c); setAddGb('1'); }}
                          style={{ padding:6, borderRadius:6, cursor:'pointer', border:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center' }}>
                          <HardDrive size={13} color="var(--primary)"/>
                        </button>
                        <button title="Renew subscription" onClick={() => { setPlanModal(c); setPlanDays('30'); }}
                          style={{ padding:6, borderRadius:6, cursor:'pointer', border:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center' }}>
                          <Calendar size={13} color="var(--success)"/>
                        </button>
                        <button title="Delete client" onClick={() => setDeleteModal(c)}
                          style={{ padding:6, borderRadius:6, cursor:'pointer', border:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center' }}>
                          <Trash2 size={13} color="var(--danger)"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && clients.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty"><div className="empty__icon">🏢</div><div className="empty__title">No clients yet</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />
      </Card>

      {/* Shared full-edit modal */}
      <ClientEditModal client={editModal} open={!!editModal} onClose={() => setEditModal(null)} />

      {/* Upgrade Displays Modal */}
      <Modal open={!!displaysModal} onClose={() => setDisplaysModal(null)}
        title={`Upgrade Displays — ${displaysModal?.company_name}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setDisplaysModal(null)}>Cancel</Button>
          <Button variant="primary" loading={displaysMut.isPending}
            onClick={() => displaysMut.mutate({ id: displaysModal.id, additional: addDisplays })}>
            Add Displays
          </Button>
        </>}>
        <div style={{ display:'flex', gap:12, marginBottom:16 }}>
          <div style={{ flex:1, background:'var(--bg-main)', borderRadius:'var(--radius-sm)', padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>Current</div>
            <div style={{ fontSize:28, fontWeight:800, color:'var(--primary)' }}>{dispCurrentDevices}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>displays</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', fontSize:20, color:'var(--text-muted)' }}>→</div>
          <div style={{ flex:1, background:'var(--success-10)', borderRadius:'var(--radius-sm)', padding:'12px 14px', textAlign:'center', border:'1px solid var(--success)' }}>
            <div style={{ fontSize:11, color:'var(--success)', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>After Upgrade</div>
            <div style={{ fontSize:28, fontWeight:800, color:'var(--success)' }}>{dispNewDevices}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>displays</div>
          </div>
        </div>
        <Field label="Add Displays">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Input type="number" min={1} max={500} value={addDisplays}
              onChange={e => setAddDisplays(e.target.value)} style={{ flex:1 }}/>
            <span style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>displays</span>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
            {[1,2,3,5,10,20].map(v => (
              <button key={v} type="button" onClick={() => setAddDisplays(String(v))}
                style={{ padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid var(--border)',
                  background: addDisplays===String(v)?'var(--primary)':'white',
                  color:      addDisplays===String(v)?'white':'var(--text-body)' }}>
                +{v}
              </button>
            ))}
          </div>
        </Field>
        {addDisplaysNum > 0 && displaysModal && (
          <div style={{ marginTop:12, background:'var(--success-10)', borderRadius:'var(--radius-sm)', padding:'12px 14px', fontSize:13, border:'1px solid var(--success)' }}>
            <div style={{ fontWeight:700, color:'var(--success)', marginBottom:8 }}>📺 What gets added</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>+{addDisplaysNum} display{addDisplaysNum>1?'s':''}</span><span style={{ fontWeight:600 }}>✓</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>+{addDisplaysNum} GB storage (1 GB per display)</span><span style={{ fontWeight:600 }}>✓</span>
              </div>
              {dispPerGbRate > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', color:'var(--warning)' }}>
                  <span>+{addDisplaysNum} GB × ₹{Math.round(dispPerGbRate)}/GB</span>
                  <span style={{ fontWeight:600 }}>+₹{dispPriceIncrease.toLocaleString('en-IN')}/mo</span>
                </div>
              )}
              <div style={{ borderTop:'1px solid var(--success)', paddingTop:6, display:'flex', justifyContent:'space-between', fontWeight:800, color:'var(--success)' }}>
                <span>New total / month</span><span>₹{dispNewPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Upgrade Storage Modal */}
      <Modal open={!!storageModal} onClose={() => setStorageModal(null)}
        title={`Upgrade Storage — ${storageModal?.company_name}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setStorageModal(null)}>Cancel</Button>
          <Button variant="primary" loading={storageMut.isPending}
            onClick={() => storageMut.mutate({ id: storageModal.id, gb: addGb })}>
            Add Storage
          </Button>
        </>}>
        <Field label="Add Storage (GB)">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Input type="number" min={1} max={500} value={addGb}
              onChange={e => setAddGb(e.target.value)} style={{ flex:1 }} />
            <span style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>GB</span>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
            {[1,2,5,10,20,50].map(v => (
              <button key={v} type="button" onClick={() => setAddGb(String(v))}
                style={{ padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid var(--border)',
                  background: addGb===String(v)?'var(--primary)':'white',
                  color:      addGb===String(v)?'white':'var(--text-body)' }}>
                +{v} GB
              </button>
            ))}
          </div>
        </Field>
        {addGbNum > 0 && storageModal && (
          <div style={{ marginTop:12, background:'var(--warning-10)', borderRadius:'var(--radius-sm)', padding:'12px 14px', fontSize:13, border:'1px solid var(--warning)' }}>
            <div style={{ fontWeight:700, color:'var(--warning)', marginBottom:8 }}>💰 Pricing Impact</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text-muted)' }}>
                <span>Current: {currentStorage} GB</span><span>₹{oldPrice.toLocaleString('en-IN')}/mo</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>+{addGbNum} GB × ₹{Math.round(perGbRate)}/GB</span>
                <span style={{ fontWeight:600, color:'var(--warning)' }}>+₹{Math.round(addedCost).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ borderTop:'1px solid var(--warning)', paddingTop:6, display:'flex', justifyContent:'space-between', fontWeight:800, color:'var(--warning)' }}>
                <span>New total / month</span><span>₹{newPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop:10, fontSize:13, color:'var(--text-muted)' }}>
          Media used: {fmt.bytes(storageModal?.used_media_mb || 0)} / {storageModal?.total_storage_gb} GB allocated
        </div>
      </Modal>

      {/* Plan Modal */}
      <Modal open={!!planModal} onClose={() => setPlanModal(null)}
        title={`Renew Subscription — ${planModal?.company_name}`} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setPlanModal(null)}>Cancel</Button>
          <Button variant="primary" loading={planMut.isPending}
            onClick={() => planMut.mutate({ id: planModal.id, days: planDays })}>
            Renew
          </Button>
        </>}>
        <Field label="Subscription Plan">
          <Select value={planDays} onChange={e => setPlanDays(e.target.value)}>
            <option value="30">Monthly (30 days)</option>
            <option value="90">Quarterly (90 days)</option>
            <option value="180">Half-Yearly (180 days)</option>
            <option value="365">Yearly (365 days)</option>
          </Select>
        </Field>
        <div style={{ marginTop:10, fontSize:13, color:'var(--text-muted)' }}>
          Current end: {fmt.date(planModal?.subscription_end)}
        </div>
      </Modal>

      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete Client"
        message={`Permanently delete "${deleteModal?.company_name}"? All data will be lost.`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteModal.id)} />
    </div>
  );
}