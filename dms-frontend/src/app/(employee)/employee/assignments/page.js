'use client';
// src/app/(employee)/employee/assignments/page.js
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssignments, createAssignment, updateAssignment,
  deleteAssignment, getDisplays, getFolders, getFolderFiles, uploadFiles,
} from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { useToast } from '../../../../components/ui/Toast';
import Card         from '../../../../components/ui/Card';
import Badge        from '../../../../components/ui/Badge';
import Button       from '../../../../components/ui/Button';
import Modal        from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Field, Input, Select } from '../../../../components/ui/Input';
import { Plus, Trash2, Edit, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Pagination from '../../../../components/ui/Pagination';
import useServerPagination from '../../../../hooks/useServerPagination';

const TABS = ['From Library', 'Upload New'];
const PAGE_SIZE = 15;

export default function EmployeeAssignments() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => qc.invalidateQueries({ queryKey:['emp-assignments'] });

  const {
    data: asgData, isLoading, page, setPage, total, totalPages,
  } = useServerPagination(['emp-assignments'], getAssignments, { limit: PAGE_SIZE });
  // Dropdown sources — need the full set, not one page.
  const { data: displayData }           = useQuery({ queryKey:['emp-displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  const { data: foldersData }           = useQuery({ queryKey:['emp-folders-all'],  queryFn: () => getFolders({ limit: 500 }) });

  const assignments = asgData?.assignments  || [];
  const displays    = displayData?.displays || [];
  const folders     = foldersData?.folders  || [];

  const [createModal, setCreateModal] = useState(false);

  const [editModal,   setEditModal]   = useState(null);
  const [delModal,    setDelModal]    = useState(null);
  const [tab,         setTab]         = useState('From Library');

  // Library tab state
  const [selFolder,     setSelFolder]     = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [form,          setForm]          = useState({ display_id:'', start_date:'', end_date:'', duration_seconds:10 });

  // Upload tab state
  const [uploadFolder, setUploadFolder] = useState('');
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [uploading,    setUploading]    = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({ start_date:'', end_date:'', duration_seconds:10 });

  const { data: folderFilesData } = useQuery({
    queryKey: ['emp-asg-files', selFolder],
    queryFn:  () => getFolderFiles(selFolder, { limit: 500 }),
    enabled:  !!selFolder,
  });
  const folderFiles = folderFilesData?.files || [];

  const onDrop = useCallback(accepted => setDroppedFiles(prev => [...prev, ...accepted]), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const toggleFile = (id) =>
    setSelectedFiles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const createMut = useMutation({
    mutationFn: (payload) => createAssignment(payload),
    onSuccess: () => {
      inv(); setCreateModal(false);
      setForm({ display_id:'', start_date:'', end_date:'', duration_seconds:10 });
      setSelFolder(''); setSelectedFiles([]); setDroppedFiles([]);
      toast('Assignment created!');
    },
    onError: (e) => toast(typeof e === 'string' ? e : e.message, 'danger'),
  });

  const editMut = useMutation({
    mutationFn: ({ id, body }) => updateAssignment(id, body),
    onSuccess: () => { inv(); setEditModal(null); toast('Updated!'); },
    onError:   (e) => toast(typeof e === 'string' ? e : e.message, 'danger'),
  });

  const delMut = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => { inv(); setDelModal(null); toast('Deleted'); },
    onError:   (e) => toast(typeof e === 'string' ? e : e.message, 'danger'),
  });

  const handleCreate = async () => {
    if (!form.display_id) return toast('Select a display', 'warning');

    if (tab === 'From Library') {
      if (!selFolder)             return toast('Select a folder', 'warning');
      if (!selectedFiles.length)  return toast('Select at least one file', 'warning');
      for (const fileId of selectedFiles) {
        await createMut.mutateAsync({
          media_bucket_id:  Number(fileId),
          display_id:       Number(form.display_id),
          start_date:       form.start_date || new Date().toISOString().slice(0,10),
          end_date:         form.end_date   || '2099-12-31',
          duration_seconds: Number(form.duration_seconds),
        });
      }
    } else {
      if (!uploadFolder.trim())   return toast('Enter a folder name', 'warning');
      if (!droppedFiles.length)   return toast('Select files to upload', 'warning');
      setUploading(true);
      try {
        const res = await uploadFiles(uploadFolder.trim(), droppedFiles);
        qc.invalidateQueries({ queryKey:['emp-folders'] });
        const freshFiles = await getFolderFiles(uploadFolder.trim(), { limit: 500 });
        const uploaded   = (freshFiles.files || []);
        for (const f of uploaded.slice(-droppedFiles.length)) {
          await createMut.mutateAsync({
            media_bucket_id:  Number(f.id),
            display_id:       Number(form.display_id),
            start_date:       form.start_date || new Date().toISOString().slice(0,10),
            end_date:         form.end_date   || '2099-12-31',
            duration_seconds: Number(form.duration_seconds),
          });
        }
      } catch(e) { toast(typeof e === 'string' ? e : e.message, 'danger'); }
      finally { setUploading(false); }
    }
  };

  const openEdit = (a) => {
    setEditForm({
      start_date:       a.start_date ? a.start_date.slice(0,10) : '',
      end_date:         (!a.end_date || a.end_date === '2099-12-31') ? '' : a.end_date.slice(0,10),
      duration_seconds: a.duration_seconds || 10,
    });
    setEditModal(a);
  };

  const resetCreate = () => {
    setCreateModal(false); setTab('From Library');
    setSelFolder(''); setSelectedFiles([]); setDroppedFiles([]);
    setForm({ display_id:'', start_date:'', end_date:'', duration_seconds:10 });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Upload Content</h2>
          <p>Assign media files to your displays</p>
        </div>
        <Button variant="primary" onClick={() => { resetCreate(); setCreateModal(true); }}>
          <Plus size={16}/> New Assignment
        </Button>
      </div>

      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Display</th><th>File</th><th>Start</th><th>End</th>
                <th>Duration</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(3)].map((_,i) => (
                <tr key={i}><td colSpan={7}><div className="skeleton" style={{height:20}}/></td></tr>
              ))}
              {assignments.map(a => (
                <tr key={a.id}>
                  <td><div className="table__name">{a.display_name || a.display_number}</div></td>
                  <td style={{fontSize:13}}>{a.file_name}</td>
                  <td style={{fontSize:12}}>{fmt.date(a.start_date)}</td>
                  <td style={{fontSize:12}}>
                    {!a.end_date || a.end_date === '2099-12-31'
                      ? <span style={{color:'var(--success)',fontSize:12}}>No expiry</span>
                      : fmt.date(a.end_date)}
                  </td>
                  <td style={{fontSize:13, fontWeight:600}}>
                    {a.duration_seconds ? `${a.duration_seconds}s` : '—'}
                  </td>
                  <td><Badge variant={a.is_active?'success':'muted'}>{a.is_active?'Active':'Inactive'}</Badge></td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Edit size={13}/></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDelModal(a)}>
                        <Trash2 size={13} color="var(--danger)"/>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && assignments.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty">
                    <div style={{fontSize:40,marginBottom:8}}>📋</div>
                    <div className="empty__title">No assignments yet</div>
                    <p style={{color:'var(--text-muted)',fontSize:13}}>Click "New Assignment" to get started</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
      </Card>

      {/* ── Create Modal ─────────────────────────────────── */}
      <Modal open={createModal} onClose={resetCreate} title="Create Content Assignment" size="lg"
        footer={<>
          <Button variant="secondary" onClick={resetCreate}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending || uploading} onClick={handleCreate}>
            {tab === 'From Library'
              ? `Assign ${selectedFiles.length || ''} File${selectedFiles.length!==1?'s':''}`
              : uploading ? 'Uploading...' : 'Upload & Assign'}
          </Button>
        </>}>

        {/* Tabs */}
        <div style={{display:'flex',gap:0,marginBottom:20,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden'}}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'9px 0', fontSize:13, fontWeight:600, cursor:'pointer', border:'none',
              background: tab===t ? 'var(--primary)' : 'white',
              color: tab===t ? 'white' : 'var(--text-body)',
            }}>{t}</button>
          ))}
        </div>

        {/* Common fields */}
        <div className="form-grid form-grid--2" style={{marginBottom:16}}>
          <Field label="Display *">
            <Select value={form.display_id} onChange={e => setForm(f=>({...f,display_id:e.target.value}))}>
              <option value="">Select display...</option>
              {displays.map(d => <option key={d.id} value={d.id}>{d.display_name} ({d.display_number})</option>)}
            </Select>
          </Field>
          <Field label="Duration (seconds)" hint="How long this shows on screen">
            <Input type="number" min={1} value={form.duration_seconds}
              onChange={e => setForm(f=>({...f,duration_seconds:e.target.value}))}/>
          </Field>
          <Field label="Start Date" hint="Defaults to today">
            <Input type="date" value={form.start_date} onChange={e => setForm(f=>({...f,start_date:e.target.value}))}/>
          </Field>
          <Field label="End Date" hint="Leave empty = no expiry">
            <Input type="date" value={form.end_date} onChange={e => setForm(f=>({...f,end_date:e.target.value}))}/>
          </Field>
        </div>

        {/* FROM LIBRARY TAB */}
        {tab === 'From Library' && (
          <div>
            <Field label="My Folder">
              <Select value={selFolder} onChange={e => { setSelFolder(e.target.value); setSelectedFiles([]); }}>
                <option value="">Select folder...</option>
                {folders.map(f => <option key={f.folder_name} value={f.folder_name}>{f.folder_name}</option>)}
              </Select>
            </Field>
            {selFolder && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
                  Select Files
                  <span style={{fontWeight:400,marginLeft:6,color:'var(--primary)'}}>{selectedFiles.length} selected</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto'}}>
                  {folderFiles.map(f => (
                    <div key={f.id} onClick={() => toggleFile(f.id)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                        borderRadius:'var(--radius-sm)',cursor:'pointer',
                        background: selectedFiles.includes(f.id) ? 'var(--primary-10)' : 'var(--bg-main)',
                        border: `1px solid ${selectedFiles.includes(f.id) ? 'var(--primary)' : 'var(--border)'}`,
                        transition:'all .15s'}}>
                      <input type="checkbox" readOnly checked={selectedFiles.includes(f.id)} style={{accentColor:'var(--primary)'}}/>
                      <span style={{fontSize:13,flex:1}}>{f.file_name}</span>
                      <Badge variant="muted">{f.file_type}</Badge>
                    </div>
                  ))}
                  {folderFiles.length === 0 && <p style={{color:'var(--text-muted)',fontSize:13,textAlign:'center',padding:16}}>No files in this folder</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* UPLOAD NEW TAB */}
        {tab === 'Upload New' && (
          <div>
            <Field label="Save to Folder" hint="Files will be saved here for future use">
              <Input placeholder="e.g. promo-june" value={uploadFolder}
                onChange={e => setUploadFolder(e.target.value)}/>
            </Field>
            <div {...getRootProps()} style={{
              border:`2px dashed ${isDragActive?'var(--primary)':'var(--border)'}`,
              borderRadius:'var(--radius-md)', padding:24, textAlign:'center', cursor:'pointer',
              background: isDragActive ? 'var(--primary-10)' : 'var(--bg-main)', marginTop:8, transition:'all .18s'}}>
              <input {...getInputProps()}/>
              <div style={{fontSize:32,marginBottom:8}}>📥</div>
              <p style={{fontWeight:600,fontSize:14}}>{isDragActive?'Drop files...':'Drag files or click to browse'}</p>
              <p style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>jpg · png · mp4 · pdf · pptx</p>
            </div>
            {droppedFiles.length > 0 && (
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:4}}>
                {droppedFiles.map((f,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',
                    background:'var(--bg-main)',borderRadius:'var(--radius-sm)',fontSize:13}}>
                    <span style={{flex:1}}>{f.name}</span>
                    <span style={{color:'var(--text-muted)',fontSize:11}}>{(f.size/1024/1024).toFixed(1)} MB</span>
                    <button onClick={() => setDroppedFiles(p=>p.filter((_,j)=>j!==i))}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)'}}>
                      <X size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Edit Modal ───────────────────────────────────── */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)}
        title={`Edit — ${editModal?.file_name || ''}`}
        footer={<>
          <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
          <Button variant="primary" loading={editMut.isPending}
            onClick={() => editMut.mutate({ id: editModal.id, body: {
              duration_seconds: Number(editForm.duration_seconds),
              start_date: editForm.start_date || undefined,
              end_date:   editForm.end_date   || undefined,
            }})}>Save Changes</Button>
        </>}>
        <div className="form-grid">
          <div style={{padding:'10px 14px',background:'var(--bg-main)',borderRadius:'var(--radius-sm)',
            border:'1px solid var(--border)',gridColumn:'1/-1'}}>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:2}}>File</div>
            <div style={{fontWeight:600}}>{editModal?.file_name}</div>
          </div>
          <Field label="Duration (seconds)">
            <Input type="number" min={1} value={editForm.duration_seconds}
              onChange={e => setEditForm(f=>({...f,duration_seconds:e.target.value}))}/>
          </Field>
          <Field label="Start Date">
            <Input type="date" value={editForm.start_date}
              onChange={e => setEditForm(f=>({...f,start_date:e.target.value}))}/>
          </Field>
          <Field label="End Date" hint="Leave empty = no expiry">
            <Input type="date" value={editForm.end_date}
              onChange={e => setEditForm(f=>({...f,end_date:e.target.value}))}/>
          </Field>
        </div>
      </Modal>

      <ConfirmModal open={!!delModal} onClose={() => setDelModal(null)}
        title="Delete Assignment" message={`Remove assignment for "${delModal?.file_name}"?`}
        loading={delMut.isPending} onConfirm={() => delMut.mutate(delModal.id)}/>
    </div>
  );
}
