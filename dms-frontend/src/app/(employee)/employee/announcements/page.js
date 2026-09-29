'use client';
// src/app/(employee)/employee/announcements/page.js
// NEW: Employee can send announcements — restricted to their own production line only
// No "All TVs" option — can only target their line or one display in it
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnnouncements, createAnnouncement, getDisplays, getUser } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { useAuth } from '../../../../lib/auth';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Field, Select } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { Plus, Megaphone, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import Pagination from '../../../../components/ui/Pagination';
import useServerPagination from '../../../../hooks/useServerPagination';

const TYPES = [
  { value:'good-news', label:'🟢 Good News', color:'#16A34A', bg:'#F0FDF4', icon: CheckCircle },
  { value:'alert',     label:'🔴 Alert',      color:'#DC2626', bg:'#FEF2F2', icon: AlertTriangle },
  { value:'info',      label:'🔵 Info / OK',  color:'#2563EB', bg:'#EFF6FF', icon: Info },
];
const DURATIONS = [
  {value:5,label:'5 minutes'},{value:10,label:'10 minutes'},{value:15,label:'15 minutes'},
  {value:30,label:'30 minutes'},{value:60,label:'1 hour'},{value:120,label:'2 hours'},
];
const typeInfo = (t) => TYPES.find(x=>x.value===t) || TYPES[2];

export default function EmployeeAnnouncementsPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const { user } = useAuth();

  const {
    data, isLoading, page, setPage, total, totalPages,
  } = useServerPagination(['emp-announcements'], getAnnouncements, { limit: 15 });
  // Display picker needs the full set, not one page.
  const { data: displaysData }  = useQuery({ queryKey:['displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  // Employee's own assigned line — the reliable source (employee_users.production_line_id
  // via getUser), not "whichever line happens to be first in the client's full list".
  const { data: meData } = useQuery({ queryKey: ['me', user?.id], queryFn: () => getUser(user.id), enabled: !!user?.id });

  const announcements = data?.announcements  || [];
  const allDisplays   = displaysData?.displays || [];

  const myLine = meData?.user?.production_line_id
    ? { id: meData.user.production_line_id, production_line_name: meData.user.production_line_name }
    : null;

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    message:'', type:'good-news', duration_minutes:10,
    target_type:'line',   // employee default = their line, no 'all' option
    target_display_id:'',
  });

  const createMut = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['emp-announcements'] });
      setModal(false);
      setForm({ message:'', type:'good-news', duration_minutes:10, target_type:'line', target_display_id:'' });
      toast('✅ Announcement sent!');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const formatMsg = (msg) => {
    const t = (msg || '').trim();
    const s = t.startsWith('***') ? t : `*** ${t}`;
    return s.endsWith('***') ? s : `${s} ***`;
  };

  const handleCreate = () => {
    if (!form.message.trim()) return toast('Enter a message', 'warning');
    if (!myLine) return toast('No production line assigned — contact your admin', 'warning');
    if (form.target_type==='display' && !form.target_display_id) return toast('Select a display', 'warning');
    createMut.mutate({
      message:          form.message,
      type:             form.type,
      duration_minutes: Number(form.duration_minutes),
      target_type:      form.target_type,
      // Backend enforces line — we still send it for clarity
      target_line_id:   myLine?.id || null,
      target_display_id: form.target_display_id ? Number(form.target_display_id) : null,
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📢 Announcements</h2>
          <p>Send a ticker message to TVs in your production line</p>
        </div>
        {myLine
          ? <Button variant="primary" onClick={() => setModal(true)}><Plus size={16}/> New Announcement</Button>
          : <div style={{ fontSize:13, color:'var(--warning)', fontWeight:600 }}>⚠️ No production line assigned</div>}
      </div>

      {/* My line info */}
      {myLine && (
        <Card style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'4px 0' }}>
            <div style={{ width:44, height:44, borderRadius:'var(--radius-md)', background:'var(--primary-10)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🔗</div>
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, marginBottom:2 }}>YOUR PRODUCTION LINE</div>
              <div style={{ fontWeight:700, fontSize:16 }}>{myLine.production_line_name}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                Announcements you send will appear on TVs in this line only
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Type guide */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
          {TYPES.map(t => (
            <div key={t.value} className="info-card" style={{ background:t.bg, border:`1px solid ${t.color}30` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <t.icon size={15} color={t.color} className="info-card__icon"/>
                <span className="info-card__label" style={{ color:t.color }}>{t.label}</span>
              </div>
              <div className="info-card__desc">Scrolling ticker at bottom of TV</div>
            </div>
          ))}
        </div>
      </Card>

      {/* List */}
      <Card title="Sent Announcements">
        {isLoading
          ? <div style={{ padding:20, textAlign:'center' }}><div className="spinner"/></div>
          : announcements.length === 0
          ? <div className="empty"><div className="empty__icon">📢</div><div className="empty__title">No announcements yet</div><p>Create one to show a message on your line's TVs</p></div>
          : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Message</th><th>Type</th><th>Target</th><th>Duration</th><th>Status</th><th>Sent</th></tr></thead>
                <tbody>
                  {announcements.map(a => {
                    const t = typeInfo(a.type);
                    const expired = a.expires_at && new Date(a.expires_at) < new Date();
                    const targetLabel = a.target_type==='display'
                      ? `TV: ${a.display_number || a.target_display_id}`
                      : `Line: ${a.production_line_name || myLine?.production_line_name || 'My Line'}`;
                    return (
                      <tr key={a.id}>
                        <td style={{ maxWidth:220 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600, fontSize:13 }}>{a.message}</div></td>
                        <td><span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:99, background:t.bg, border:`1px solid ${t.color}30`, fontSize:12, fontWeight:700, color:t.color }}>{t.label}</span></td>
                        <td><Badge variant={a.target_type==='display'?'secondary':'warning'}>{targetLabel}</Badge></td>
                        <td style={{ fontSize:13 }}>{a.duration_minutes} min</td>
                        <td><Badge variant={expired?'muted':'success'} dot>{expired?'Expired':'Active'}</Badge></td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(a.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />
      </Card>

      {/* Create Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="📢 New Announcement"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending} onClick={handleCreate}>
            <Megaphone size={14}/> Send Announcement
          </Button>
        </>}>
        <div className="form-grid">
          {/* Message */}
          <Field label="Message *" hint="This scrolls at the bottom of TV screens">
            <textarea className="input" rows={2}
              placeholder="e.g. 🎉 Quality targets hit — great work team!"
              value={form.message}
              onChange={e => setForm(f=>({...f, message:e.target.value}))}
              style={{ resize:'none' }}/>
            <div style={{ textAlign:'right', fontSize:11, marginTop:3,
              color: form.message.trim().split(' ').filter(w=>w).length >= 50 ? '#DC2626' : 'var(--text-muted)' }}>
              {form.message.trim() ? form.message.trim().split(' ').filter(w=>w).length : 0} / 50 words
            </div>
          </Field>

          {/* Type */}
          <Field label="Type">
            <div style={{ display:'flex', gap:8 }}>
              {TYPES.map(t => (
                <div key={t.value} onClick={() => setForm(f=>({...f, type:t.value}))}
                  style={{ flex:1, padding:'10px 8px', borderRadius:'var(--radius-sm)', cursor:'pointer', textAlign:'center',
                    border:`1.5px solid ${form.type===t.value ? t.color : 'var(--border)'}`,
                    background: form.type===t.value ? t.bg : 'white' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{t.value==='good-news'?'🟢':t.value==='alert'?'🔴':'🔵'}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:t.color }}>{t.label.replace(/^.. /,'')}</div>
                </div>
              ))}
            </div>
          </Field>

          {/* Duration */}
          <Field label="Show for">
            <Select value={form.duration_minutes} onChange={e => setForm(f=>({...f, duration_minutes:Number(e.target.value)}))}>
              {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          </Field>

          {/* Target — employee: line OR single display, no "all" */}
          <div style={{ background:'var(--bg-main)', borderRadius:'var(--radius-md)', padding:14 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Who sees this?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { v:'line',    label:`📺 All TVs in my line`,  desc: myLine ? myLine.production_line_name : 'Your assigned line' },
                { v:'display', label:'📍 One specific TV',      desc:'Pick one display in your line' },
              ].map(opt => (
                <div key={opt.v} onClick={() => setForm(f=>({...f, target_type:opt.v, target_display_id:''}))}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                    border:`1.5px solid ${form.target_type===opt.v ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.target_type===opt.v ? 'var(--primary-10)' : 'white' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${form.target_type===opt.v ? 'var(--primary)' : 'var(--border)'}`, background:form.target_type===opt.v?'var(--primary)':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {form.target_type===opt.v && <div style={{ width:8, height:8, borderRadius:'50%', background:'white' }}/>}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{opt.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {form.target_type === 'display' && (
              <div style={{ marginTop:12 }}>
                <Field label="Select Display *">
                  <Select value={form.target_display_id} onChange={e => setForm(f=>({...f, target_display_id:e.target.value}))}>
                    <option value="">Choose display...</option>
                    {allDisplays.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.display_name} ({d.display_number}) — {d.status}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>

          {/* Preview */}
          {form.message && (
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:6 }}>PREVIEW</div>
              <div style={{ background:'#111', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
                <div style={{ background:typeInfo(form.type).color, padding:'8px 14px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'white', whiteSpace:'nowrap', background:'rgba(0,0,0,0.25)', padding:'2px 8px', borderRadius:4 }}>
                    {typeInfo(form.type).label.replace(/^.. /,'').toUpperCase()}
                  </span>
                  <span style={{ color:'white', fontSize:13, fontWeight:600 }}>{form.message}</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                Target: <strong>
                  {form.target_type==='line' ? `All TVs in ${myLine?.production_line_name||'my line'}` : (allDisplays.find(d=>String(d.id)===String(form.target_display_id))?.display_name || 'Selected display')}
                </strong> · {form.duration_minutes} min
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}