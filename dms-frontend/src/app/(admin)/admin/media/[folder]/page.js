// src/app/(admin)/admin/media/[folder]/page.js
'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFolderFiles, deleteMediaFile, reorderFiles, renameFolder } from '../../../../../lib/api';
import { fmt, thumbUrl } from '../../../../../lib/utils';
import Card from '../../../../../components/ui/Card';
import Badge from '../../../../../components/ui/Badge';
import Button from '../../../../../components/ui/Button';
import ConfirmModal from '../../../../../components/ui/ConfirmModal';
import Modal from '../../../../../components/ui/Modal';
import { Field, Input } from '../../../../../components/ui/Input';
import { useToast } from '../../../../../components/ui/Toast';
import { ArrowLeft, Trash2, ArrowUp, ArrowDown, Edit, X, Play } from 'lucide-react';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

const TYPE_COLOR = { video:'primary', image:'success', pdf:'warning', presentation:'secondary' };
const TYPE_LABEL = { video:'Video', image:'Image', pdf:'PDF', presentation:'Slides' };

// Build preview URL via the proxy for images and videos
// FIX: file_path is already "uploads/db/folder/file.png" (with the s).
// The old check tested for "upload" (no s), never matched, and produced
// /api/logo?path=/uploads/uploads/... -> 404.
// Reuse the shared thumbUrl helper so every page resolves paths identically.
const getPreviewUrl = (file) => thumbUrl(file?.file_path);

// Thumbnail component — shows actual image or type icon card
function FileThumbnail({ file, onClick }) {
  const [imgError, setImgError] = useState(false);
  const url = getPreviewUrl(file);

  if (file.file_type === 'image' && url && !imgError) {
    return (
      <div onClick={onClick} style={{ width:56, height:56, borderRadius:8, overflow:'hidden', cursor:'pointer', flexShrink:0, border:'1px solid var(--border)', position:'relative' }}>
        <img
          src={url}
          alt={file.file_name}
          style={{ width:'100%', height:'100%', objectFit:'cover' }}
          onError={() => setImgError(true)}
        />
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0)', transition:'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,.3)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(0,0,0,0)'}
        />
      </div>
    );
  }

  const iconMap = { video:'🎬', image:'🖼️', pdf:'📄', presentation:'📊' };
  const bgMap   = { video:'#EFF6FF', image:'#F0FDF4', pdf:'#FFF7ED', presentation:'#FAF5FF' };
  const colorMap= { video:'#3B82F6', image:'#22C55E', pdf:'#F97316', presentation:'#A855F7' };

  return (
    <div onClick={onClick} style={{
      width:56, height:56, borderRadius:8, flexShrink:0, cursor: file.file_type==='video' ? 'pointer' : 'default',
      background: bgMap[file.file_type] || '#F9FAFB',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:28, border:`1px solid ${colorMap[file.file_type]}30`,
    }}>
      {iconMap[file.file_type] || '📄'}
    </div>
  );
}

// Full-screen preview modal
function PreviewModal({ file, onClose }) {
  if (!file) return null;
  const url = getPreviewUrl(file);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'85vh' }}>
        <button onClick={onClose} style={{
          position:'absolute', top:-40, right:0, color:'white', background:'none', border:'none', cursor:'pointer', fontSize:24,
        }}>
          <X size={24} />
        </button>
        <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginBottom:8, textAlign:'center' }}>{file.file_name}</div>

        {file.file_type === 'image' && url && (
          <img src={url} alt={file.file_name} style={{ maxWidth:'85vw', maxHeight:'80vh', borderRadius:8, objectFit:'contain' }} />
        )}
        {file.file_type === 'video' && url && (
          <video controls autoPlay style={{ maxWidth:'85vw', maxHeight:'80vh', borderRadius:8 }}>
            <source src={url} />
            Your browser does not support video playback.
          </video>
        )}
        {(file.file_type === 'pdf' || file.file_type === 'presentation') && (
          <div style={{ background:'white', borderRadius:8, padding:48, textAlign:'center' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>{file.file_type === 'pdf' ? '📄' : '📊'}</div>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>{file.file_name}</div>
            <div style={{ color:'#6B7280', marginBottom:16 }}>{fmt.bytes(file.file_size_mb)} · {TYPE_LABEL[file.file_type]}</div>
            <a href={url} target="_blank" rel="noreferrer"
              style={{ color:'var(--primary)', fontWeight:600, fontSize:14 }}>Open file →</a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FolderDetailPage() {
  const { folder } = useParams();
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => qc.invalidateQueries({ queryKey: ['folder-files', folder] });

  // Full list (not paginated) — reordering needs every file in the folder to
  // compute correct sequence swaps, not just one page of them.
  const { data } = useQuery({ queryKey: ['folder-files', folder], queryFn: () => getFolderFiles(folder, { limit: 500 }) });
  const files = data?.files || [];

  const [deleteModal, setDeleteModal] = useState(null);
  const [renameModal, setRenameModal] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [newName,     setNewName]     = useState('');
  const [localOrder,  setLocalOrder]  = useState(null);

  const orderedFiles = localOrder
    ? localOrder.map(id => files.find(f => f.id === id)).filter(Boolean)
    : [...files].sort((a,b) => (a.sequence||0) - (b.sequence||0));

  const deleteMut = useMutation({
    mutationFn: (id) => deleteMediaFile(id),
    onSuccess: () => { inv(); setDeleteModal(null); toast('File deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const reorderMut = useMutation({
    mutationFn: (order) => reorderFiles({ order }),
    onSuccess: () => { inv(); setLocalOrder(null); toast('Order saved!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const renameMut = useMutation({
    mutationFn: () => renameFolder(folder, { new_name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      toast(`Renamed to "${newName}"`);
      setRenameModal(false);
      window.location.href = `/admin/media/${newName.toLowerCase().trim()}`;
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const moveFile = (idx, dir) => {
    const ids = orderedFiles.map(f => f.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    setLocalOrder(ids);
  };

  const saveOrder = () => {
    const order = orderedFiles.map((f, idx) => ({ id: f.id, sequence: idx + 1 }));
    reorderMut.mutate(order);
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/admin/media"><Button variant="ghost" size="sm"><ArrowLeft size={16}/></Button></Link>
          <div>
            <h2>📁 {folder}</h2>
            <p>{files.length} files · Click thumbnails to preview</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {localOrder && (
            <Button variant="primary" size="sm" loading={reorderMut.isPending} onClick={saveOrder}>Save Order</Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => { setNewName(folder); setRenameModal(true); }}>
            <Edit size={14}/> Rename
          </Button>
        </div>
      </div>

      <div style={{ background:'var(--primary-10)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--primary)', fontWeight:500 }}>
        💡 Files matched to TVs by <strong>display_number</strong> in filename. E.g. <code>DISP-001-banner.jpg</code> → TV DISP-001
      </div>

      {/* File grid — thumbnails + list */}
      <Card>
        {/* Thumbnail grid for images */}
        {files.some(f => f.file_type === 'image') && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.06em' }}>
              Image Previews
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {orderedFiles.filter(f => f.file_type === 'image').map(f => (
                <div key={f.id} style={{ textAlign:'center' }}>
                  <div style={{ width:80, height:80, borderRadius:8, overflow:'hidden', cursor:'pointer', border:'2px solid var(--border)', transition:'border-color .15s' }}
                    onClick={() => setPreviewFile(f)}
                    onMouseEnter={e => e.currentTarget.style.borderColor='var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                  >
                    <img
                      src={getPreviewUrl(f)}
                      alt={f.file_name}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}
                      onError={e => { e.target.parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;background:#F0FDF4">🖼️</div>'; }}
                    />
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.file_name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full file list */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Preview</th><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Order</th><th></th></tr>
            </thead>
            <tbody>
              {orderedFiles.map((f, idx) => (
                <tr key={f.id}>
                  <td>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                      {idx + 1}
                    </div>
                  </td>
                  <td>
                    <FileThumbnail file={f} onClick={() => (f.file_type==='image'||f.file_type==='video') && setPreviewFile(f)} />
                  </td>
                  <td>
                    <div className="table__name">{f.file_name}</div>
                    {f.file_path && <div className="table__sub" style={{ fontSize:10 }}>{f.file_path.split('/').slice(-2).join('/')}</div>}
                  </td>
                  <td><Badge variant={TYPE_COLOR[f.file_type]||'primary'}>{TYPE_LABEL[f.file_type]||f.file_type}</Badge></td>
                  <td style={{ fontSize:13 }}>{fmt.bytes(f.file_size_mb)}</td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(f.created_at)}</td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button disabled={idx===0} onClick={() => moveFile(idx,-1)}
                        style={{ padding:'3px 6px', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', background:'white', opacity:idx===0?.4:1 }}>
                        <ArrowUp size={12}/>
                      </button>
                      <button disabled={idx===orderedFiles.length-1} onClick={() => moveFile(idx,1)}
                        style={{ padding:'3px 6px', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', background:'white', opacity:idx===orderedFiles.length-1?.4:1 }}>
                        <ArrowDown size={12}/>
                      </button>
                    </div>
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteModal(f)}>
                      <Trash2 size={14} color="var(--danger)"/>
                    </Button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr><td colSpan={8}><div className="empty"><div className="empty__title">No files in this folder</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Preview modal */}
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}

      {/* Rename modal */}
      <Modal open={renameModal} onClose={() => setRenameModal(false)} title="Rename Folder" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setRenameModal(false)}>Cancel</Button>
          <Button variant="primary" loading={renameMut.isPending} onClick={() => renameMut.mutate()}>Rename</Button>
        </>}>
        <Field label="New Folder Name">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="new-folder-name" />
        </Field>
      </Modal>

      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="Delete File"
        message={`Delete "${deleteModal?.file_name}"?`}
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate(deleteModal.id)} />
    </div>
  );
}