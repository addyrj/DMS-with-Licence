// src/app/(superadmin)/notifications/page.js
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminNotifs, createNotification, deleteNotification, getClients } from '../../../lib/api';
import { fmt } from '../../../lib/utils';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import Pagination from '../../../components/ui/Pagination';
import useServerPagination from '../../../hooks/useServerPagination';
import { Field, Input, Select } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { Plus, Trash2, Send, Users, Globe } from 'lucide-react';

const TYPE_META = {
  info:    { label:'Info',    color:'var(--primary)',  bg:'var(--primary-10)',  icon:'ℹ️' },
  feature: { label:'Feature', color:'#8B5CF6',         bg:'rgba(139,92,246,.1)', icon:'✨' },
  warning: { label:'Warning', color:'var(--warning)',  bg:'var(--warning-10)', icon:'⚠️' },
  urgent:  { label:'Urgent',  color:'var(--danger)',   bg:'var(--danger-10)',  icon:'🚨' },
};

export default function NotificationsPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => { qc.invalidateQueries({ queryKey: ['admin-notifs'] }); qc.invalidateQueries({ queryKey: ['admin-notifs-all'] }); };

  // The per-type quick-stats row needs counts across ALL notifications, not
  // just the visible page — kept as a separate full-set fetch.
  const { data: allData } = useQuery({ queryKey: ['admin-notifs-all'], queryFn: () => getAdminNotifs({ limit: 500 }) });
  const allNotifications  = allData?.notifications || [];

  const { data, page, setPage, total, totalPages } =
    useServerPagination(['admin-notifs'], getAdminNotifs, { limit: 15 });
  // Client picker in the "send notification" modal needs the full client list, not one page.
  const { data: cData }  = useQuery({ queryKey: ['clients-all'], queryFn: () => getClients({ limit: 500 }) });

  const notifications = data?.notifications || [];
  const clients       = cData?.clients || [];

  const [modal,        setModal]        = useState(false);
  const [deleteModal,  setDeleteModal]  = useState(null);
  const [selClients,   setSelClients]   = useState([]);

  const blank = { title:'', message:'', type:'info', target:'all' };
  const [form, setForm] = useState(blank);

  const createMut = useMutation({
    mutationFn: (payload) => createNotification(payload),
    onSuccess: () => { inv(); setModal(false); setForm(blank); setSelClients([]); toast('Notification sent!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteNotification(id),
    onSuccess: () => { inv(); setDeleteModal(null); toast('Notification deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const toggleClient = (id) =>
    setSelClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSend = () => {
    if (!form.title.trim()) return toast('Title required', 'warning');
    if (!form.message.trim()) return toast('Message required', 'warning');
    if (form.target === 'specific' && selClients.length === 0) return toast('Select at least one client', 'warning');
    createMut.mutate({ ...form, client_ids: form.target === 'specific' ? selClients : [] });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <p>Send announcements, feature updates, and alerts to your clients</p>
        </div>
        <Button variant="primary" onClick={() => { setForm(blank); setSelClients([]); setModal(true); }}>
          <Plus size={16} /> Send Notification
        </Button>
      </div>

      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:16, marginBottom:24 }}>
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const count = allNotifications.filter(n => n.type === type).length;
          return (
            <div key={type} style={{ background:'white', borderRadius:'var(--radius-md)', padding:'16px 20px', boxShadow:'var(--shadow-sm)', borderLeft:`4px solid ${meta.color}` }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{meta.icon}</div>
              <div style={{ fontSize:22, fontWeight:800, color: meta.color }}>{count}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{meta.label}</div>
            </div>
          );
        })}
      </div>

      {/* Notifications list */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {notifications.length === 0 && (
          <Card>
            <div className="empty">
              <div style={{ fontSize:48, marginBottom:12 }}>📢</div>
              <div className="empty__title">No notifications sent yet</div>
              <p style={{ marginTop:4, marginBottom:16 }}>Send your first notification to clients</p>
              <Button variant="primary" onClick={() => setModal(true)}>Send Notification</Button>
            </div>
          </Card>
        )}
        {notifications.map(n => {
          const meta = TYPE_META[n.type] || TYPE_META.info;
          return (
            <div key={n.id} style={{ background:'white', borderRadius:'var(--radius-lg)', padding:'20px 24px', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)', display:'flex', gap:16 }}>
              {/* Type icon */}
              <div style={{ width:44, height:44, borderRadius:'var(--radius-md)', background: meta.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                {meta.icon}
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)' }}>{n.title}</span>
                  <Badge variant={n.type === 'urgent' ? 'danger' : n.type === 'warning' ? 'warning' : 'primary'}>
                    {meta.label}
                  </Badge>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-muted)' }}>
                    {n.target === 'all' ? <><Globe size={12} /> All clients</> : <><Users size={12} /> {n.target_count} specific</>}
                  </div>
                  <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:'auto' }}>
                    {fmt.ago(n.created_at)} · {n.read_count} read
                  </span>
                </div>
                <p style={{ fontSize:14, color:'var(--text-body)', lineHeight:1.6 }}>{n.message}</p>
              </div>

              {/* Delete */}
              <Button variant="ghost" size="sm" onClick={() => setDeleteModal(n)} style={{ flexShrink:0, alignSelf:'flex-start' }}>
                <Trash2 size={14} color="var(--danger)" />
              </Button>
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />

      {/* Send modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Send Notification to Clients"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending} onClick={handleSend}>
            <Send size={14} /> Send
          </Button>
        </>}>
        <div className="form-grid">

          {/* Type */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))', gap:8 }}>
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <button key={type} type="button" onClick={() => setForm(f => ({...f, type}))}
                style={{ padding:'10px 8px', borderRadius:'var(--radius-sm)', cursor:'pointer', textAlign:'center', fontSize:12, fontWeight:700,
                  border:`2px solid ${form.type===type ? meta.color : 'var(--border)'}`,
                  background: form.type===type ? meta.bg : 'white',
                  color: form.type===type ? meta.color : 'var(--text-muted)',
                  transition:'all .15s' }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{meta.icon}</div>
                {meta.label}
              </button>
            ))}
          </div>

          <Field label="Title *">
            <Input placeholder="e.g. New Feature: Display Temperature Monitoring"
              value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          </Field>

          <Field label="Message *">
            <textarea
              placeholder="Write your message here. Describe the feature, update, or alert..."
              value={form.message}
              onChange={e => setForm(f => ({...f, message: e.target.value}))}
              rows={4}
              className="input"
              style={{ resize:'vertical', minHeight:100 }}
            />
          </Field>

          {/* Target */}
          <Field label="Send To">
            <div style={{ display:'flex', gap:8 }}>
              {[
                { val:'all',      label:'All Clients',      icon:<Globe size={14}/> },
                { val:'specific', label:'Specific Clients', icon:<Users size={14}/> },
              ].map(opt => (
                <button key={opt.val} type="button" onClick={() => setForm(f => ({...f, target: opt.val}))}
                  style={{ flex:1, padding:'10px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    border:`2px solid ${form.target===opt.val ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.target===opt.val ? 'var(--primary-10)' : 'white',
                    color: form.target===opt.val ? 'var(--primary)' : 'var(--text-muted)',
                    transition:'all .15s' }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Specific client picker */}
          {form.target === 'specific' && (
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-body)', marginBottom:8 }}>
                Select Clients ({selClients.length} selected)
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto' }}>
                {clients.map(c => {
                  const sel = selClients.includes(c.id);
                  return (
                    <div key={c.id} onClick={() => toggleClient(c.id)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                        border:`1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                        background: sel ? 'var(--primary-10)' : 'white', transition:'all .15s' }}>
                      <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${sel?'var(--primary)':'var(--border)'}`, background:sel?'var(--primary)':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {sel && <span style={{ color:'white', fontSize:11, fontWeight:800 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'var(--text-heading)' }}>{c.company_name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.admin_username}</div>
                      </div>
                      <Badge variant={c.is_active?'success':'muted'} style={{ marginLeft:'auto' }}>{c.is_active?'Active':'Inactive'}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {(form.title || form.message) && (
            <div style={{ background: TYPE_META[form.type]?.bg, border:`1px solid ${TYPE_META[form.type]?.color}`, borderRadius:'var(--radius-md)', padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color: TYPE_META[form.type]?.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                {TYPE_META[form.type]?.icon} Preview — what clients will see
              </div>
              {form.title && <div style={{ fontWeight:700, fontSize:14, color:'var(--text-heading)', marginBottom:4 }}>{form.title}</div>}
              {form.message && <div style={{ fontSize:13, color:'var(--text-body)', lineHeight:1.5 }}>{form.message}</div>}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete Notification"
        message={`Delete "${deleteModal?.title}"? Clients will no longer see this notification.`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteModal.id)} />
    </div>
  );
}
