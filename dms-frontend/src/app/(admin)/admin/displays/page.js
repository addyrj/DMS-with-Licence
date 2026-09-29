// src/app/(admin)/admin/displays/page.js
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDisplays, getDisplayLimit, createDisplay, updateDisplay, deleteDisplay, setVolume } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Card from '../../../../components/ui/Card';
import Modal from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import ProgressBar from '../../../../components/ui/ProgressBar';
import { Field, Input } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { Plus, Trash2, Volume2, Edit, Monitor, AlertTriangle, Thermometer } from 'lucide-react';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';
import Link from 'next/link';

export default function DisplaysPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => {
    qc.invalidateQueries({ queryKey: ['displays'] });
    qc.invalidateQueries({ queryKey: ['displays-all'] });
    qc.invalidateQueries({ queryKey: ['display-limit'] });
  };

  // Online/offline counts and the "already used numbers" form hint need the
  // FULL display set, not just the visible page — kept as a separate fetch.
  const { data: allData } = useQuery({ queryKey: ['displays-all'], queryFn: () => getDisplays({ limit: 500 }), refetchInterval: 15_000 });
  const allDisplays = allData?.displays || [];

  const { data, isLoading, page, setPage, total, totalPages } =
    useServerPagination(['displays'], getDisplays, { limit: 10, refetchInterval: 15_000 });
  const displays = data?.displays || [];

  const { data: limitData } = useQuery({ queryKey: ['display-limit'], queryFn: getDisplayLimit });

  const limit     = limitData || { current: total, max: 0, canAdd: true };
  const usedPct   = limit.max > 0 ? Math.round((limit.current / limit.max) * 100) : 0;

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [copied,      setCopied]      = useState(null);
  const [form, setForm] = useState({ display_name:'', display_number:'', display_password:'' });
  const [editName, setEditName] = useState('');

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const createMut = useMutation({
    mutationFn: createDisplay,
    onSuccess: () => {
      inv();
      setCreateModal(false);
      setForm({ display_name:'', display_number:'', display_password:'' });
      toast('Display created!');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const editMut = useMutation({
    mutationFn: ({ id, name }) => updateDisplay(id, { display_name: name }),
    onSuccess: () => { inv(); setEditModal(null); toast('Display renamed'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteDisplay(id),
    onSuccess: () => { inv(); setDeleteModal(null); toast('Display deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const volMut = useMutation({
    mutationFn: ({ id, vol }) => setVolume(id, { volume_level: vol }),
    onSuccess: inv,
  });

  const online  = allDisplays.filter(d => d.status === 'ONLINE').length;
  const offline = allDisplays.length - online;

  const tempColor = (s) =>
    s === 'critical' ? 'var(--danger)' : s === 'warning' ? 'var(--warning)' : 'var(--success)';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Displays</h2>
          <p>
            {total} total ·{' '}
            <span style={{ color:'var(--success)', fontWeight:600 }}>{online} online</span>
            {offline > 0 && <> · <span style={{ color:'var(--danger)', fontWeight:600 }}>{offline} offline</span></>}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Display limit counter */}
          {limit.max > 0 && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:13, fontWeight:600, color: usedPct >= 100 ? 'var(--danger)' : 'var(--text-heading)' }}>
                {limit.current} / {limit.max} displays
              </div>
              <div style={{ width:100, marginTop:4 }}>
                <ProgressBar value={usedPct} max={100} size="sm" />
              </div>
            </div>
          )}
          <Button
            variant="primary"
            onClick={() => setCreateModal(true)}
            disabled={!limit.canAdd}
            title={!limit.canAdd ? `Limit reached (${limit.current}/${limit.max}). Ask Super Admin to increase allocation.` : ''}
          >
            <Plus size={16} /> Add Display
          </Button>
        </div>
      </div>

      {/* Limit reached warning */}
      {!limit.canAdd && (
        <div style={{ background:'var(--warning-10)', border:'1px solid var(--warning)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:20, display:'flex', gap:10, fontSize:13 }}>
          <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink:0, marginTop:2 }} />
          <span style={{ color:'var(--warning)', fontWeight:600 }}>
            Display limit reached ({limit.current}/{limit.max}). Contact your Super Admin to increase your allocation.
          </span>
        </div>
      )}

      {/* Summary stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Displays', value: total, color:'var(--primary)',  icon:'📺' },
          { label:'Online',         value: online,          color:'var(--success)',  icon:'🟢' },
          { label:'Offline',        value: offline,         color:'var(--danger)',   icon:'🔴' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="summary-stat">
            <div className="summary-stat__icon" style={{ background:`${color}18` }}>
              {icon}
            </div>
            <div>
              <div className="summary-stat__value">{value}</div>
              <div className="summary-stat__label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Display cards grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
        {isLoading && [...Array(4)].map((_,i) => (
          <div key={i} className="skeleton" style={{ height:220, borderRadius:'var(--radius-lg)' }} />
        ))}

        {displays.map(d => (
          <Card key={d.id} style={{ position:'relative', overflow:'hidden' }}>
            {/* Status indicator bar at top */}
            <div style={{
              position:'absolute', top:0, left:0, right:0, height:4,
              background: d.status === 'ONLINE' ? 'var(--success)' : 'var(--danger)',
            }} />

            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12, marginTop:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {d.display_name}
                </div>
                <code style={{ fontSize:12, color:'var(--text-muted)' }}>{d.display_number}</code>
              </div>
              <Badge variant={d.status === 'ONLINE' ? 'success' : 'danger'} dot>
                {d.status}
              </Badge>
            </div>

            {/* Metrics row */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              {d.temperature && (
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color: tempColor(d.temperature_status) }}>
                  <Thermometer size={12} />
                  {d.temperature}
                </div>
              )}
              {d.uptime_today_minutes > 0 && (
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                  ⏱ {Math.floor(d.uptime_today_minutes/60)}h {d.uptime_today_minutes%60}m uptime
                </div>
              )}
              {d.content_loops_today > 0 && (
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                  🔁 {d.content_loops_today} loops
                </div>
              )}
            </div>

            {/* Last heartbeat */}
            {d.last_heartbeat && (
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                Last seen: {fmt.ago(d.last_heartbeat)}
              </div>
            )}

            {/* Storage — TV free space */}
            {d.storage_available && (
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>
                📦 {d.storage_available} free on device
              </div>
            )}

            {/* Content storage — media files assigned */}
            <div style={{ fontSize:12, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'var(--text-muted)' }}>📁 Content:</span>
              <span style={{ fontWeight:600, color: d.media_storage_mb > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                {d.media_storage_mb ? fmt.bytes(d.media_storage_mb) : '0 MB'} assigned
              </span>
            </div>

            {/* Volume slider */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <Volume2 size={13} color="var(--text-muted)" />
              <input
                type="range" min={0} max={100} value={d.volume_level || 0}
                onChange={e => volMut.mutate({ id: d.id, vol: Number(e.target.value) })}
                style={{ flex:1, accentColor:'var(--primary)', height:4 }}
              />
              <span style={{ fontSize:12, minWidth:32, color:'var(--text-muted)' }}>{d.volume_level || 0}%</span>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:8 }}>
              <Link href={`/admin/displays/${d.id}`} style={{ flex:1 }}>
                <Button variant="secondary" size="sm" style={{ width:'100%' }}>
                  <Monitor size={13} /> Details
                </Button>
              </Link>
              <Button variant="ghost" size="sm" title="Rename" onClick={() => { setEditModal(d); setEditName(d.display_name); }}>
                <Edit size={13} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteModal(d)}>
                <Trash2 size={13} color="var(--danger)" />
              </Button>
            </div>
          </Card>
        ))}

        {!isLoading && displays.length === 0 && (
          <Card style={{ gridColumn:'1/-1' }}>
            <div className="empty">
              <div className="empty__icon">📺</div>
              <div className="empty__title">No displays yet</div>
              <p>Add your first TV display to get started.</p>
              {limit.canAdd && (
                <Button variant="primary" style={{ marginTop:16 }} onClick={() => setCreateModal(true)}>
                  <Plus size={16} /> Add Display
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={10} onPage={setPage} />

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add New Display"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending} onClick={() => createMut.mutate(form)}>
            Create Display
          </Button>
        </>}>
        <div className="form-grid">
          <Field label="Display Name *" hint="Human-readable label e.g. Reception Screen">
            <Input placeholder="e.g. Factory Floor TV" value={form.display_name} onChange={setF('display_name')} />
          </Field>
          <Field label="Display Number *"
            hint={allDisplays.length > 0
              ? `Already used: ${allDisplays.map(d => d.display_number).join(', ')} — pick a different number`
              : 'e.g. DISP-001 — used to match media filenames'}>
            <Input placeholder="e.g. DISP-001" value={form.display_number} onChange={setF('display_number')} />
          </Field>
          <Field label="Display Password *" hint="TV device uses this to authenticate">
            <Input type="password" placeholder="Min 6 characters" value={form.display_password} onChange={setF('display_password')} />
          </Field>
          <div style={{ background:'var(--primary-10)', padding:'12px 14px', borderRadius:'var(--radius-sm)', fontSize:13, color:'var(--primary)', fontWeight:500 }}>
            💡 This will use 1 GB of your storage allocation.
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Rename Display" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
          <Button variant="primary" loading={editMut.isPending} onClick={() => editMut.mutate({ id: editModal.id, name: editName })}>
            Save
          </Button>
        </>}>
        <Field label="New Display Name">
          <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Enter new name" />
        </Field>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete Display"
        message={`Delete "${deleteModal?.display_name}" (${deleteModal?.display_number})? This cannot be undone.`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteModal.id)}
      />
    </div>
  );
}
