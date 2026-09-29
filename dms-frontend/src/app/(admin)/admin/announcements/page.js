'use client';
// src/app/(admin)/admin/announcements/page.js
// UPDATED: Line → Display targeting in create modal
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, getLines, getDisplays } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Field, Select } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { Plus, Trash2, Megaphone, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';

const TYPES = [
  { value:'good-news', label:'🟢 Good News', color:'#16A34A', bg:'#F0FDF4', icon: CheckCircle },
  { value:'alert',     label:'🔴 Alert',      color:'#DC2626', bg:'#FEF2F2', icon: AlertTriangle },
  { value:'info',      label:'🔵 Info / OK',  color:'#2563EB', bg:'#EFF6FF', icon: Info },
];
const DURATIONS = [
  {value:5,label:'5 minutes'},{value:10,label:'10 minutes'},{value:15,label:'15 minutes'},
  {value:30,label:'30 minutes'},{value:60,label:'1 hour'},{value:120,label:'2 hours'},{value:480,label:'8 hours'},
];
const typeInfo = (t) => TYPES.find(x => x.value === t) || TYPES[2];

export default function AnnouncementsPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const { data, isLoading, page, setPage, total, totalPages } =
    useServerPagination(['announcements'], getAnnouncements, { limit: 15 });
  // Line/display pickers in the create modal need the full sets, not one page.
  const { data: linesData }      = useQuery({ queryKey:['lines-all'],    queryFn: () => getLines({ limit: 500 }) });
  const { data: displaysData }   = useQuery({ queryKey:['displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  const announcements = data?.announcements || [];
  const lines         = linesData?.lines     || [];
  const allDisplays   = displaysData?.displays || [];

  const [modal,   setModal]   = useState(false);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState({
    message:'', type:'good-news', duration_minutes:10,
    target_type:'all', target_line_id:'', target_display_id:'',
  });

  // Displays filtered by selected line (for targeting)
  const displaysByLine = (() => {
    if (!form.target_line_id) return allDisplays;
    const line = lines.find(l => String(l.id) === String(form.target_line_id));
    if (!line) return allDisplays;
    const nums = (line.display_numbers || '').split(',').map(s => s.trim()).filter(Boolean);
    return nums.length ? allDisplays.filter(d => nums.includes(d.display_number)) : allDisplays;
  })();

  const createMut = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['announcements'] });
      setModal(false);
      setForm({ message:'', type:'good-news', duration_minutes:10, target_type:'all', target_line_id:'', target_display_id:'' });
      toast('✅ Announcement sent!');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAnnouncement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['announcements'] }); setDelItem(null); toast('Removed'); },
    onError: (e) => toast(e.message, 'danger'),
  });

  const formatMsg = (msg) => {
    const t = (msg || '').trim();
    const s = t.startsWith('***') ? t : `*** ${t}`;
    return s.endsWith('***') ? s : `${s} ***`;
  };

  const handleCreate = () => {
    if (!form.message.trim()) return toast('Enter a message', 'warning');
    if (form.target_type === 'line' && !form.target_line_id) return toast('Select a production line', 'warning');
    if (form.target_type === 'display' && !form.target_display_id) return toast('Select a display', 'warning');
    createMut.mutate({
      message:          formatMsg(form.message),
      type:             form.type,
      duration_minutes: Number(form.duration_minutes),
      target_type:      form.target_type,
      target_line_id:   form.target_line_id   ? Number(form.target_line_id)   : null,
      target_display_id: form.target_display_id ? Number(form.target_display_id) : null,
    });
  };

  const TARGET_LABELS = { all:'All TVs', line:'Production Line', display:'Single Display' };

  return (
    <div>
      <div className="page-header">
        <div><h2>📢 Display Announcements</h2><p>Ticker banner on TVs while content plays</p></div>
        <Button variant="primary" onClick={() => setModal(true)}><Plus size={16}/> New Announcement</Button>
      </div>

      {/* Type info cards */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
          {TYPES.map(t => (
            <div key={t.value} className="info-card" style={{ background:t.bg, border:`1px solid ${t.color}30` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <t.icon size={15} color={t.color} className="info-card__icon"/>
                <span className="info-card__label" style={{ color:t.color }}>{t.label}</span>
              </div>
              <div className="info-card__desc">Scrolling ticker at bottom of TV screen</div>
            </div>
          ))}
        </div>
      </Card>

      {/* List */}
      <Card title="Sent Announcements">
        {isLoading ? <div style={{ padding:20, textAlign:'center' }}><div className="spinner"/></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Message</th><th>Type</th><th>Target</th><th>Duration</th><th>Status</th><th>Sent</th><th></th></tr></thead>
              <tbody>
                {announcements.map(a => {
                  const t = typeInfo(a.type);
                  const expired = a.expires_at && new Date(a.expires_at) < new Date();
                  const targetLabel = a.target_type === 'line'
                    ? `Line: ${a.production_line_name || a.target_line_id}`
                    : a.target_type === 'display'
                    ? `TV: ${a.display_number || a.target_display_id}`
                    : 'All TVs';
                  return (
                    <tr key={a.id}>
                      <td style={{ maxWidth:240 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600, fontSize:13 }}>{a.message}</div></td>
                      <td><span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:99, background:t.bg, border:`1px solid ${t.color}30`, fontSize:12, fontWeight:700, color:t.color }}>{t.label}</span></td>
                      <td><Badge variant={a.target_type==='all'?'primary':a.target_type==='line'?'warning':'secondary'}>{targetLabel}</Badge></td>
                      <td style={{ fontSize:13 }}>{a.duration_minutes} min</td>
                      <td><Badge variant={expired?'muted':'success'} dot>{expired?'Expired':'Active'}</Badge></td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(a.created_at)}</td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          {/* Resend: create new with same params */}
                          <Button variant="ghost" size="sm" title="Resend this announcement"
                            loading={createMut.isPending}
                            onClick={() => createMut.mutate({
                              message: a.message, type: a.type,
                              duration_minutes: a.duration_minutes,
                              target_type: a.target_type || 'all',
                              target_line_id: a.target_line_id || null,
                              target_display_id: a.target_display_id || null,
                            })}>
                            🔄
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDelItem(a)}>
                            <Trash2 size={13} color="var(--danger)"/>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!announcements.length && <tr key="ann-empty"><td colSpan={7}><div className="empty"><div className="empty__icon">📢</div><div className="empty__title">No announcements yet</div></div></td></tr>}
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
          <Field label="Message *" hint="This scrolls across TV screens">
            <textarea className="input" rows={2} placeholder="e.g. 🎉 Great work hitting targets this month!"
              value={form.message} onChange={ev => {
                const words = ev.target.value.trim().split(' ').filter(w => w.length > 0);
                if (words.length <= 50) setForm(f=>({...f,message:ev.target.value}));
              }} style={{ resize:'none', height:80, overflowY:'auto', fontSize:13 }}/>
            <div style={{ textAlign:'right', fontSize:11, marginTop:3,
              color: form.message.trim().split(' ').filter(w=>w).length >= 50 ? '#DC2626' : 'var(--text-muted)' }}>
              {form.message.trim() ? form.message.trim().split(' ').filter(w=>w).length : 0} / 50 words
            </div>
          </Field>

          {/* Type */}
          <Field label="Type">
            <div style={{ display:'flex', gap:8 }}>
              {TYPES.map(t => (
                <div key={t.value} onClick={() => setForm(f=>({...f,type:t.value}))}
                  style={{ flex:1, padding:'10px 8px', borderRadius:'var(--radius-sm)', cursor:'pointer', textAlign:'center',
                    border:`1.5px solid ${form.type===t.value?t.color:'var(--border)'}`,
                    background: form.type===t.value ? t.bg : 'white' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>
                    {t.value==='good-news'?'🟢':t.value==='alert'?'🔴':'🔵'}
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:t.color }}>{t.label.replace(/^.. /,'')}</div>
                </div>
              ))}
            </div>
          </Field>

          {/* Duration */}
          <Field label="Show for">
            <Select value={form.duration_minutes} onChange={e => setForm(f=>({...f,duration_minutes:Number(e.target.value)}))}>
              {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          </Field>

          {/* TARGET — new targeting section */}
          <div style={{ background:'var(--bg-main)', borderRadius:'var(--radius-md)', padding:14 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Who sees this?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { v:'all',     label:'📺 All TVs',              desc:'Every TV in your account' },
                { v:'line',    label:'🔗 Production Line',       desc:'All TVs in one line' },
                { v:'display', label:'📍 Single Display',        desc:'One specific TV only' },
              ].map(opt => (
                <div key={opt.v} onClick={() => setForm(f=>({...f,target_type:opt.v,target_line_id:'',target_display_id:''}))}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                    border:`1.5px solid ${form.target_type===opt.v?'var(--primary)':'var(--border)'}`,
                    background: form.target_type===opt.v?'var(--primary-10)':'white' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${form.target_type===opt.v?'var(--primary)':'var(--border)'}`, background:form.target_type===opt.v?'var(--primary)':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {form.target_type===opt.v && <div style={{ width:8, height:8, borderRadius:'50%', background:'white' }}/>}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{opt.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Line picker */}
            {form.target_type === 'line' && (
              <div style={{ marginTop:12 }}>
                <Field label="Select Production Line">
                  <Select value={form.target_line_id} onChange={e => setForm(f=>({...f,target_line_id:e.target.value,target_display_id:''}))}>
                    <option value="">Choose line...</option>
                    {lines.map(l => <option key={l.id} value={l.id}>{l.production_line_name}</option>)}
                  </Select>
                </Field>
              </div>
            )}

            {/* Display picker — filtered by line if one is selected */}
            {form.target_type === 'display' && (
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
                <Field label="Filter by Line (optional)">
                  <Select value={form.target_line_id} onChange={e => setForm(f=>({...f,target_line_id:e.target.value,target_display_id:''}))}>
                    <option value="">All lines...</option>
                    {lines.map(l => <option key={l.id} value={l.id}>{l.production_line_name}</option>)}
                  </Select>
                </Field>
                <Field label="Select Display *">
                  <Select value={form.target_display_id} onChange={e => setForm(f=>({...f,target_display_id:e.target.value}))}>
                    <option value="">Choose display...</option>
                    {displaysByLine.map(d => (
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
                <div style={{ background:typeInfo(form.type).color, padding:'0 14px', display:'flex', alignItems:'center', gap:0, overflow:'hidden', height:44 }}>
                  {/* Badge */}
                  <span style={{ fontSize:11, fontWeight:800, color:'white', whiteSpace:'nowrap', flexShrink:0, background:'rgba(0,0,0,0.25)', padding:'4px 10px', borderRadius:4, marginRight:10 }}>
                    {typeInfo(form.type).label.replace(/^.. /,'').toUpperCase()}
                  </span>
                  {/* Scrolling ticker — same as TV */}
                  <div style={{ overflow:'hidden', flex:1, height:44, display:'flex', alignItems:'center' }}>
                    <style>{`@keyframes dms-ann2 { 0% { transform:translateX(100%) } 100% { transform:translateX(-100%) } }`}</style>
                    <span style={{ display:'inline-block', whiteSpace:'nowrap', color:'white', fontSize:13, fontWeight:700, animation:'dms-ann2 18s linear infinite', letterSpacing:0.3 }}>
                      {(()=>{ const t=(form.message||'').trim(); const s=t.startsWith('***')?t:`*** ${t}`; return s.endsWith('***')?s:`${s} ***`; })()}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                Target: <strong>{form.target_type==='all'?'All TVs':form.target_type==='line'?(lines.find(l=>String(l.id)===String(form.target_line_id))?.production_line_name||'Selected line'):(allDisplays.find(d=>String(d.id)===String(form.target_display_id))?.display_name||'Selected display')}</strong>
                {' · '}{form.duration_minutes} min
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!delItem} onClose={() => setDelItem(null)}
        title="Remove Announcement"
        message={`Remove: "${delItem?.message?.slice(0,60)}..."?`}
        loading={deleteMut.isPending} onConfirm={() => deleteMut.mutate(delItem.id)}/>
    </div>
  );
}