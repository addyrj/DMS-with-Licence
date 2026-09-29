// src/app/(admin)/admin/assignments/page.js
'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssignments, createAssignment, updateAssignment,
  toggleAssignment, deleteAssignment,
  getDisplays, getFolderFiles, getFolders, uploadFiles,
} from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Field, Input, Select } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';

// Tab: "From Library" or "Upload New"
const TABS = ['From Library', 'Upload New'];

export default function AssignmentsPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => { qc.invalidateQueries({ queryKey:['assignments'] }); qc.invalidateQueries({ queryKey:['assignments-all'] }); };

  // Active/inactive counts in the header need the full assignment set, not
  // just the visible page — kept as a separate full-set fetch.
  const { data: allData } = useQuery({ queryKey:['assignments-all'], queryFn: () => getAssignments({ limit: 500 }) });
  const allAssignments = allData?.assignments || [];

  const { data, page, setPage, total, totalPages } =
    useServerPagination(['assignments'], getAssignments, { limit: 15 });
  const assignments = data?.assignments || [];

  // Dropdown sources — need the full set, not one page
  const { data: displays } = useQuery({ queryKey:['displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  const { data: folders }  = useQuery({ queryKey:['folders-all'],  queryFn: () => getFolders({ limit: 500 }) });

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [tab,         setTab]         = useState('From Library');

  // Library tab state
  const [selFolder,    setSelFolder]    = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]); // array of file IDs
  const [form, setForm] = useState({
    display_id:'', start_date:'', end_date:'', duration_seconds: 10,
  });

  // Upload tab state
  const [uploadFolder,  setUploadFolder]  = useState('');
  const [droppedFiles,  setDroppedFiles]  = useState([]);
  const [uploading,     setUploading]     = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({ start_date:'', end_date:'', duration_seconds:10 });

  const { data: folderFiles } = useQuery({
    queryKey: ['folder-files-asg', selFolder],
    queryFn:  () => getFolderFiles(selFolder, { limit: 500 }),
    enabled:  !!selFolder,
  });
  const files = folderFiles?.files || [];

  const onDrop = useCallback(accepted => setDroppedFiles(prev => [...prev, ...accepted]), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const createMut = useMutation({
    mutationFn: (payload) => createAssignment(payload),
    onSuccess: () => {
      inv(); setCreateModal(false);
      setForm({ display_id:'', start_date:'', end_date:'', duration_seconds:10 });
      setSelFolder(''); setSelectedFiles([]); setDroppedFiles([]);
      toast('Assignment created!');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const editMut = useMutation({
    mutationFn: ({ id, body }) => updateAssignment(id, body),
    onSuccess: () => { inv(); setEditModal(null); toast('Updated!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const toggleMut = useMutation({ mutationFn: toggleAssignment, onSuccess: inv, onError: (e) => toast(e.message, 'danger') });
  const deleteMut = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => { inv(); setDeleteModal(null); toast('Deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const toggleFile = (id) =>
    setSelectedFiles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreate = async () => {
    if (!form.display_id) return toast('Select a display', 'warning');

    if (tab === 'From Library') {
      if (!selFolder) return toast('Select a folder', 'warning');
      if (selectedFiles.length === 0) return toast('Select at least one file', 'warning');
      // Create one assignment per selected file
      for (const fileId of selectedFiles) {
        await createMut.mutateAsync({
          media_bucket_id: Number(fileId),
          display_id:      Number(form.display_id),
          start_date:      form.start_date || new Date().toISOString().slice(0,10),
          end_date:        form.end_date   || '2099-12-31',
          duration_seconds: Number(form.duration_seconds),
        });
      }
    } else {
      // Upload new files first then assign
      if (!uploadFolder.trim()) return toast('Enter a folder name', 'warning');
      if (droppedFiles.length === 0) return toast('Select files to upload', 'warning');
      setUploading(true);
      try {
        const res = await uploadFiles(uploadFolder.trim(), droppedFiles);
        qc.invalidateQueries({ queryKey: ['folders'] });
        // Now create assignment for each uploaded file
        const uploaded = res.uploaded || [];
        for (const f of uploaded) {
          // Get the bucket ID for the uploaded file
          const freshFiles = await getFolderFiles(uploadFolder.trim(), { limit: 500 });
          const match = (freshFiles.files || []).find(bf => bf.file_name === f.file_name);
          if (match) {
            await createMut.mutateAsync({
              media_bucket_id: Number(match.id),
              display_id:      Number(form.display_id),
              start_date:      form.start_date || new Date().toISOString().slice(0,10),
              end_date:        form.end_date   || '2099-12-31',
              duration_seconds: Number(form.duration_seconds),
            });
          }
        }
        setDroppedFiles([]);
        setUploadFolder('');
      } catch(e) {
        toast(e.message, 'danger');
      } finally {
        setUploading(false);
      }
    }
  };

  const active   = allAssignments.filter(a => a.is_active).length;
  const inactive = allAssignments.length - active;

  return (
    <div>
      <div className="page-header">
        <div><h2>Content Assignments</h2><p>{total} total · {active} active · {inactive} inactive</p></div>
        <Button variant="primary" onClick={() => { setCreateModal(true); setTab('From Library'); }}>
          <Plus size={16} />New Assignment
        </Button>
      </div>

      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>File</th><th>Type</th><th>Display</th><th>Period</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="table__name">{a.file_name}</div>
                    <div className="table__sub">📁 {a.folder_name}</div>
                  </td>
                  <td><Badge variant="primary">{a.file_type}</Badge></td>
                  <td>
                    <div className="table__name">{a.display_name||a.display_number}</div>
                    <Badge variant={a.display_status==='ONLINE'?'success':'danger'}>{a.display_status}</Badge>
                  </td>
                  <td style={{ fontSize:12 }}>
                    {a.end_date === '2099-12-31'
                      ? <span>From {fmt.date(a.start_date)} · <span style={{ color:'var(--success)' }}>No expiry</span></span>
                      : `${fmt.date(a.start_date)} → ${fmt.date(a.end_date)}`
                    }
                  </td>
                  <td><Badge variant={a.is_active?'success':'muted'} dot>{a.is_active?'Active':'Inactive'}</Badge></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditForm({ start_date: a.start_date?.slice(0,10)||'', end_date: a.end_date?.slice(0,10)===`2099-12-31`?'':a.end_date?.slice(0,10)||'', duration_seconds: a.duration_seconds||10 });
                        setEditModal(a);
                      }}><Edit size={13} /></Button>
                      <Button variant="ghost" size="sm" loading={toggleMut.isPending}
                        onClick={() => toggleMut.mutate(a.id)}
                        style={{ fontSize:11, fontWeight:700, color:a.is_active?'var(--warning)':'var(--success)' }}>
                        {a.is_active?'OFF':'ON'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteModal(a)}>
                        <Trash2 size={13} color="var(--danger)" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr><td colSpan={6}><div className="empty"><div className="empty__icon">📅</div><div className="empty__title">No assignments yet</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={15} onPage={setPage} />
      </Card>

      {/* Create modal — with tabs and multi-file */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Content Assignment"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending || uploading} onClick={handleCreate}>
            {tab === 'From Library'
              ? `Assign ${selectedFiles.length || ''} file${selectedFiles.length !== 1 ? 's' : ''}`
              : 'Upload & Assign'}
          </Button>
        </>}>
        <div className="form-grid">
          {/* Tab switcher */}
          <div style={{ display:'flex', gap:0, borderRadius:'var(--radius-sm)', overflow:'hidden', border:'1px solid var(--border)', width:'fit-content' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', border:'none',
                  background: tab === t ? 'var(--primary)' : 'white',
                  color:      tab === t ? 'white' : 'var(--text-body)',
                  transition: 'all .15s' }}>
                {t}
              </button>
            ))}
          </div>

          {/* Common: display + dates + duration */}
          <Field label="Display *">
            <Select value={form.display_id} onChange={e => setForm(f => ({...f, display_id: e.target.value}))}>
              <option value="">Select display...</option>
              {(displays?.displays||[]).map(d => <option key={d.id} value={d.id}>{d.display_name} ({d.display_number})</option>)}
            </Select>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Start Date" hint="Defaults to today if empty">
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} />
            </Field>
            <Field label="End Date" hint="Leave empty for no expiry">
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} />
            </Field>
          </div>

          <Field label="Duration (seconds)" hint="How long each file shows on screen">
            <Input type="number" min={1} value={form.duration_seconds} onChange={e => setForm(f => ({...f, duration_seconds: e.target.value}))} />
          </Field>

          {/* FROM LIBRARY TAB */}
          {tab === 'From Library' && (
            <>
              <Field label="Folder">
                <Select value={selFolder} onChange={e => { setSelFolder(e.target.value); setSelectedFiles([]); }}>
                  <option value="">Select folder...</option>
                  {(folders?.folders||[]).map(f => <option key={f.folder_name} value={f.folder_name}>{f.folder_name} ({f.file_count} files)</option>)}
                </Select>
              </Field>

              {selFolder && files.length > 0 && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <label style={{ fontSize:13, fontWeight:600, color:'var(--text-body)' }}>Files — select one or more</label>
                    <button onClick={() => setSelectedFiles(selectedFiles.length === files.length ? [] : files.map(f=>f.id))}
                      style={{ fontSize:12, color:'var(--primary)', fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>
                      {selectedFiles.length === files.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
                    {files.map(f => {
                      const selected = selectedFiles.includes(f.id);
                      return (
                        <div key={f.id} onClick={() => toggleFile(f.id)}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:'var(--radius-sm)', cursor:'pointer',
                            border:`1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                            background: selected ? 'var(--primary-10)' : 'white', transition:'all .15s' }}>
                          <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${selected?'var(--primary)':'var(--border)'}`,
                            background: selected ? 'var(--primary)' : 'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {selected && <span style={{ color:'white', fontSize:11, fontWeight:800 }}>✓</span>}
                          </div>
                          <span style={{ fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.file_name}</span>
                          <Badge variant="primary">{f.file_type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                  {selectedFiles.length > 0 && (
                    <div style={{ fontSize:12, color:'var(--primary)', fontWeight:600, marginTop:8 }}>
                      {selectedFiles.length} file{selectedFiles.length>1?'s':''} selected
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* UPLOAD NEW TAB */}
          {tab === 'Upload New' && (
            <>
              <Field label="Save to Folder" hint="Files will be saved here for future use">
                <Input placeholder="e.g. promo-june" value={uploadFolder} onChange={e => setUploadFolder(e.target.value)} />
              </Field>
              <div {...getRootProps()} style={{ border:`2px dashed ${isDragActive?'var(--primary)':'var(--border)'}`, borderRadius:'var(--radius-md)', padding:24, textAlign:'center', cursor:'pointer', background:isDragActive?'var(--primary-10)':'var(--bg-main)' }}>
                <input {...getInputProps()} />
                <div style={{ fontSize:28, marginBottom:8 }}>📥</div>
                <p style={{ fontSize:13, fontWeight:600, color:'var(--text-heading)' }}>{isDragActive ? 'Drop files here...' : 'Drag files or click to browse'}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>jpg · png · mp4 · pdf · pptx</p>
              </div>
              {droppedFiles.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:140, overflowY:'auto' }}>
                  {droppedFiles.map((f,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:13 }}>
                      <span>📄</span>
                      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                      <span style={{ color:'var(--text-muted)', fontSize:12 }}>{(f.size/1024/1024).toFixed(1)} MB</span>
                      <button onClick={() => setDroppedFiles(p => p.filter((_,j) => j!==i))} style={{ color:'var(--danger)', background:'none', border:'none', cursor:'pointer', fontSize:16 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Assignment" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
          <Button variant="primary" loading={editMut.isPending}
            onClick={() => editMut.mutate({ id: editModal.id, body: {
              ...editForm,
              end_date: editForm.end_date || '2099-12-31',
            }})}>Save</Button>
        </>}>
        <div className="form-grid">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Start Date"><Input type="date" value={editForm.start_date} onChange={e=>setEditForm(f=>({...f,start_date:e.target.value}))} /></Field>
            <Field label="End Date" hint="Empty = no expiry"><Input type="date" value={editForm.end_date} onChange={e=>setEditForm(f=>({...f,end_date:e.target.value}))} /></Field>
          </div>
          <Field label="Duration (seconds)">
            <Input type="number" min={1} value={editForm.duration_seconds} onChange={e=>setEditForm(f=>({...f,duration_seconds:e.target.value}))} />
          </Field>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete Assignment"
        message={`Remove assignment for "${deleteModal?.file_name}"?`}
        loading={deleteMut.isPending} onConfirm={() => deleteMut.mutate(deleteModal.id)} />
    </div>
  );
}
