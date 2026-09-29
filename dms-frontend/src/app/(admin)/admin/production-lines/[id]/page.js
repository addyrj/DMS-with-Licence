// src/app/(admin)/production-lines/[id]/page.js
'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLine, updateLine, updateLineDisplays, updateTvOrder, getDisplays, getAssignedDisplays } from '../../../../../lib/api';
import Card from '../../../../../components/ui/Card';
import Badge from '../../../../../components/ui/Badge';
import Button from '../../../../../components/ui/Button';
import Toggle from '../../../../../components/ui/Toggle';
import Modal from '../../../../../components/ui/Modal';
import { Field, Input, Textarea } from '../../../../../components/ui/Input';
import { useToast } from '../../../../../components/ui/Toast';
import { ArrowLeft, ArrowUp, ArrowDown, Edit } from 'lucide-react';
import Link from 'next/link';

export default function LineDetailPage() {
  const { id }   = useParams();
  const toast    = useToast();
  const qc       = useQueryClient();
  const inv      = () => qc.invalidateQueries({ queryKey: ['line', id] });

  const { data }       = useQuery({ queryKey: ['line', id],    queryFn: () => getLine(id) });
  // Display picker for this line needs the full display set, not one page.
  const { data: dData }      = useQuery({ queryKey: ['displays-all'],      queryFn: () => getDisplays({ limit: 500 }) });
  const { data: assignedData } = useQuery({ queryKey: ['assigned-displays'], queryFn: getAssignedDisplays });
  const line       = data?.line;
  const allDisplays  = dData?.displays || [];
  // Feature 6: map of display_id → line_name for already-assigned displays
  const assignedMap  = {};
  const _asgArr = Array.isArray(assignedData?.assigned) ? assignedData.assigned
               : Array.isArray(assignedData) ? assignedData
               : [];
  _asgArr.forEach(a => { if (a?.display_id) assignedMap[a.display_id] = a.production_line_name; });

  const [editModal, setEditModal] = useState(false);
  const [editForm,  setEditForm]  = useState({ production_line_name:'', description:'' });

  // TV order state — stored locally until saved
  const [tvOrder, setTvOrder] = useState(null);

  const currentOrder = tvOrder || (line?.tv_order ? JSON.parse(line.tv_order).map(String) : []);
  const attachedIds  = allDisplays.filter(d => currentOrder.includes(String(d.id))).map(d => d.id);
  const orderedDisplays = currentOrder
    .map(oid => allDisplays.find(d => String(d.id) === oid))
    .filter(Boolean);

  // Mutations
  const editMut = useMutation({
    mutationFn: (body) => updateLine(id, body),
    onSuccess: () => { inv(); setEditModal(false); toast('Updated!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const toggleMut = useMutation({
    mutationFn: () => updateLine(id, { active_line: !line?.active_line }),
    onSuccess: inv,
    onError:   (e) => toast(e.message, 'danger'),
  });

  const displaysMut = useMutation({
    mutationFn: (ids) => updateLineDisplays(id, { display_ids: ids }),
    onSuccess: inv,
    onError:   (e) => toast(e.message, 'danger'),
  });

  const orderMut = useMutation({
    mutationFn: (order) => updateTvOrder(id, { tv_order: order }),
    onSuccess: () => { inv(); setTvOrder(null); toast('TV download order saved!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const toggleDisplay = (dId) => {
    const strId = String(dId);
    const newOrder = currentOrder.includes(strId)
      ? currentOrder.filter(x => x !== strId)
      : [...currentOrder, strId];
    setTvOrder(newOrder);
    displaysMut.mutate(newOrder.map(Number));
  };

  const moveUp   = (idx) => { const o=[...currentOrder]; [o[idx-1],o[idx]]=[o[idx],o[idx-1]]; setTvOrder(o); };
  const moveDown = (idx) => { const o=[...currentOrder]; [o[idx+1],o[idx]]=[o[idx],o[idx+1]]; setTvOrder(o); };

  if (!line) return <div style={{ padding:40, textAlign:'center' }}><div className="spinner spinner--lg" style={{ margin:'0 auto' }} /></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/admin/production-lines">
            <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
          </Link>
          <div>
            <h2>{line.production_line_name}</h2>
            <p style={{ marginTop:2 }}>{line.description || 'No description'}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Button variant="secondary" size="sm" onClick={() => { setEditForm({ production_line_name:line.production_line_name, description:line.description||'' }); setEditModal(true); }}>
            <Edit size={14} /> Edit
          </Button>
          <Toggle checked={!!line.active_line} onChange={() => toggleMut.mutate()} label="Active" />
        </div>
      </div>

      <div className="two-col" style={{ marginBottom:20 }}>
        {/* TV order panel */}
        <Card title="Download Order" subtitle="TVs download content in this sequence — first TV starts immediately">
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {orderedDisplays.length === 0 && (
              <div className="empty"><div className="empty__title">No displays attached</div><p>Add displays below</p></div>
            )}
            {orderedDisplays.map((d, idx) => (
              <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{d.display_name}</div>
                  <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d.display_number}</code>
                </div>
                <Badge variant={d.status==='ONLINE' ? 'success' : 'danger'}>{d.status}</Badge>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button disabled={idx === 0} onClick={() => moveUp(idx)}
                    style={{ padding:'2px 4px', border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', background:'white', opacity: idx===0 ? .4 : 1 }}>
                    <ArrowUp size={12} />
                  </button>
                  <button disabled={idx === orderedDisplays.length-1} onClick={() => moveDown(idx)}
                    style={{ padding:'2px 4px', border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', background:'white', opacity: idx===orderedDisplays.length-1 ? .4 : 1 }}>
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {tvOrder && (
            <Button variant="primary" size="sm" loading={orderMut.isPending} onClick={() => orderMut.mutate(tvOrder)}>
              Save Order
            </Button>
          )}
        </Card>

        {/* Attach/detach displays */}
        <Card title="Displays" subtitle="Toggle to attach or detach from this line">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {allDisplays.map(d => {
              const attached    = attachedIds.includes(d.id);
              // A display is locked if it's assigned to a DIFFERENT line (not this one)
              const otherLine   = assignedMap[d.display_id || d.id];
              const lockedLine  = otherLine && !attached ? otherLine : null;

              return (
                <div key={d.id}
                  onClick={() => !lockedLine && toggleDisplay(d.id)}
                  title={lockedLine ? `Already assigned to "${lockedLine}"` : ''}
                  style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                    borderRadius:'var(--radius-sm)',
                    cursor: lockedLine ? 'not-allowed' : 'pointer',
                    border:`1.5px solid ${attached ? 'var(--primary)' : lockedLine ? 'var(--border)' : 'var(--border)'}`,
                    background: attached ? 'var(--primary-10)' : lockedLine ? 'var(--bg-main)' : 'white',
                    opacity: lockedLine ? 0.55 : 1,
                    transition:'all .18s',
                  }}>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:d.status==='ONLINE'?'var(--success)':'var(--danger)',flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, color: lockedLine ? 'var(--text-muted)' : 'var(--text-heading)' }}>
                      {d.display_name}
                    </div>
                    <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d.display_number}</code>
                    {lockedLine && (
                      <div style={{ fontSize:11, color:'var(--warning)', marginTop:2 }}>
                        🔒 Assigned to "{lockedLine}"
                      </div>
                    )}
                  </div>
                  {attached && <span style={{ fontSize:12, color:'var(--primary)', fontWeight:700 }}>✓</span>}
                </div>
              );
            })}
            {allDisplays.length === 0 && <div className="empty"><div className="empty__title">No displays available</div></div>}
          </div>
        </Card>
      </div>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Production Line"
        footer={<>
          <Button variant="secondary" onClick={() => setEditModal(false)}>Cancel</Button>
          <Button variant="primary" loading={editMut.isPending} onClick={() => editMut.mutate(editForm)}>
            Save Changes
          </Button>
        </>}>
        <div className="form-grid">
          <Field label="Line Name *">
            <Input value={editForm.production_line_name}
              onChange={e => setEditForm(f => ({...f, production_line_name: e.target.value}))} />
          </Field>
          <Field label="Description">
            <Textarea value={editForm.description}
              onChange={e => setEditForm(f => ({...f, description: e.target.value}))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}