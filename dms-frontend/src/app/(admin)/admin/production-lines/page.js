// src/app/(admin)/production-lines/page.js
// FIX 3: Active/Inactive is now a clear pill-badge button.
//         Clicking "Inactive" makes it Active (green).
//         Clicking "Active" makes it Inactive (grey).
//         Cache is invalidated immediately on success so the UI updates.
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLines, createLine, deleteLine, toggleActiveLine,
  getDisplays, getAssignedDisplays,
} from '../../../../lib/api';
import Card         from '../../../../components/ui/Card';
import Button       from '../../../../components/ui/Button';
import Modal        from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Field, Input, Textarea } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { Plus, Trash2, GitBranch, Monitor } from 'lucide-react';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';
import Link from 'next/link';

export default function ProductionLinesPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => qc.invalidateQueries({ queryKey:['lines'] });

  const { data, isLoading, page, setPage, total, totalPages } =
    useServerPagination(['lines'], getLines, { limit: 15 });
  // Display picker in the "create line" modal needs the full display set, not one page.
  const { data: disp }             = useQuery({ queryKey:['displays-all'],       queryFn: () => getDisplays({ limit: 500 }) });
  const { data: asgd }             = useQuery({ queryKey:['assigned-displays'],  queryFn: getAssignedDisplays });

  const lines       = data?.lines       || [];
  const allDisplays = disp?.displays    || [];

  // Map display_id → line name for already-assigned displays
  const assignedMap = {};
  // Guard: handle any response shape from backend
  const _assignedArr = Array.isArray(asgd?.assigned) ? asgd.assigned
                     : Array.isArray(asgd) ? asgd
                     : [];
  _assignedArr.forEach(a => { if (a?.display_id) assignedMap[a.display_id] = a.production_line_name; });

  const [createModal,   setCreateModal]   = useState(false);
  const [deleteModal,   setDeleteModal]   = useState(null);
  const [selDisplayIds, setSelDisplayIds] = useState([]);
  const [form,          setForm]          = useState({ production_line_name:'', description:'' });

  const createMut = useMutation({
    mutationFn: (d) => createLine(d),
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey:['assigned-displays'] });
      setCreateModal(false);
      setForm({ production_line_name:'', description:'' });
      setSelDisplayIds([]);
      toast('Production line created!');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteLine(id),
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey:['assigned-displays'] });
      setDeleteModal(null);
      toast('Line deleted');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  // FIX 3: toggle mutation — invalidates immediately and uses optimistic feedback
  const toggleMut = useMutation({
    mutationFn: (id) => toggleActiveLine(id),
    onSuccess: () => {
      inv(); // refresh lines so badge reflects new state
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const toggleDisplay = (id) => {
    if (assignedMap[id]) return; // locked — already in another line
    setSelDisplayIds(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id]);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Production Lines</h2>
          <p>Manage departments and display groups</p>
        </div>
        <Button variant="primary" onClick={() => { setSelDisplayIds([]); setCreateModal(true); }}>
          <Plus size={16}/> New Line
        </Button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {isLoading && [...Array(3)].map((_,i) => (
          <div key={i} className="skeleton" style={{ height:88, borderRadius:'var(--radius-lg)' }}/>
        ))}

        {lines.map(line => {
          const isActive = !!line.active_line;
          return (
            <Card key={line.id} flat>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                {/* Icon */}
                <div style={{ width:44, height:44, borderRadius:'var(--radius-md)', flexShrink:0,
                              background: isActive ? 'var(--success-10)' : 'var(--bg-main)',
                              border: `1px solid ${isActive ? 'var(--success)' : 'var(--border)'}`,
                              display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <GitBranch size={20} color={isActive ? 'var(--success)' : 'var(--text-muted)'}/>
                </div>

                {/* Name + description */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)' }}>
                    {line.production_line_name}
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>
                    {line.description || 'No description'}
                  </div>
                  {line.display_numbers && (
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4, display:'flex', alignItems:'center', gap:4 }}>
                      <Monitor size={11}/> {line.display_numbers}
                    </div>
                  )}
                </div>

                {/* FIX 3: explicit Active / Inactive button-badge */}
                <button
                  onClick={() => toggleMut.mutate(line.id)}
                  disabled={toggleMut.isPending}
                  title={isActive ? 'Click to deactivate' : 'Click to activate'}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 99,
                    border: `1.5px solid ${isActive ? 'var(--success)' : 'var(--border)'}`,
                    background: isActive ? 'var(--success-10)' : 'white',
                    color: isActive ? 'var(--success)' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all .18s',
                    minWidth: 90,
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                  <div style={{ width:7, height:7, borderRadius:'50%',
                                background: isActive ? 'var(--success)' : 'var(--text-muted)' }}/>
                  {toggleMut.isPending && toggleMut.variables === line.id
                    ? '...'
                    : isActive ? 'Active' : 'Inactive'}
                </button>

                {/* Manage link */}
                <Link href={`/admin/production-lines/${line.id}`}>
                  <Button variant="secondary" size="sm">Manage</Button>
                </Link>

                {/* Delete */}
                <Button variant="ghost" size="sm" onClick={() => setDeleteModal(line)}>
                  <Trash2 size={14} color="var(--danger)"/>
                </Button>
              </div>
            </Card>
          );
        })}

        {!isLoading && lines.length === 0 && (
          <Card>
            <div className="empty">
              <div className="empty__icon">🏭</div>
              <div className="empty__title">No production lines yet</div>
              <Button variant="primary" style={{ marginTop:12 }} onClick={() => setCreateModal(true)}>
                <Plus size={14}/> Create First Line
              </Button>
            </div>
          </Card>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />

      {/* ── Create Modal ── */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Production Line"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending}
            onClick={() => createMut.mutate({
              ...form,
              display_ids: selDisplayIds,
              tv_order:    selDisplayIds.map(String),
            })}>
            Create
          </Button>
        </>}>
        <div className="form-grid">
          <Field label="Line Name *">
            <Input placeholder="e.g. Assembly Line A"
              value={form.production_line_name}
              onChange={e => setForm(f => ({ ...f, production_line_name: e.target.value }))}/>
          </Field>
          <Field label="Description">
            <Textarea placeholder="Optional description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/>
          </Field>

          <Field label="Attach Displays"
            hint="Locked displays (🔒) are already assigned to another line">
            <div style={{ display:'flex', flexDirection:'column', gap:6,
                          maxHeight:220, overflowY:'auto', border:'1px solid var(--border)',
                          borderRadius:'var(--radius-sm)', padding:8 }}>
              {allDisplays.map(d => {
                const locked  = !!assignedMap[d.id];
                const sel     = selDisplayIds.includes(d.id);
                return (
                  <div key={d.id}
                    title={locked ? `Already in "${assignedMap[d.id]}"` : ''}
                    onClick={() => toggleDisplay(d.id)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                             borderRadius:'var(--radius-sm)', cursor: locked ? 'not-allowed' : 'pointer',
                             background: sel ? 'var(--primary-10)' : 'white',
                             border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                             opacity: locked ? 0.5 : 1, transition:'all .15s' }}>
                    <div style={{ width:16, height:16, borderRadius:3,
                                  border: `2px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                                  background: sel ? 'var(--primary)' : 'white',
                                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {sel && <span style={{ color:'white', fontSize:9, fontWeight:800 }}>✓</span>}
                    </div>
                    <div style={{ width:7, height:7, borderRadius:'50%',
                                  background: d.status==='ONLINE' ? 'var(--success)' : 'var(--danger)',
                                  flexShrink:0 }}/>
                    <Monitor size={12} color="var(--text-muted)"/>
                    <span style={{ fontSize:13, flex:1 }}>{d.display_name}</span>
                    <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d.display_number}</code>
                    {locked && <span style={{ fontSize:12 }}>🔒</span>}
                  </div>
                );
              })}
              {allDisplays.length === 0 && (
                <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:16 }}>
                  No displays available
                </p>
              )}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete Production Line"
        message={`Delete "${deleteModal?.production_line_name}"? This will remove all associated content assignments.`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteModal.id)}/>
    </div>
  );
}