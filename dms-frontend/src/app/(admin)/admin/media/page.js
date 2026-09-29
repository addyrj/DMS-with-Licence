// src/app/(admin)/admin/media/page.js
// Features:
//  1. Thumbnail column — images show actual preview, others show type icon
//  2. Table: # | Preview | File | Type | Size | Uploaded | Order | Action
//  3. ↑ ↓ order buttons call reorderFiles API (updates sequence in DB)
//  4. Folder creation modal shows naming-convention help popup
'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFolders, getFolderFiles, uploadFiles,
  deleteMediaFile, deleteFolder, renameFolder, reorderFiles,
} from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import { useToast } from '../../../../components/ui/Toast';
import Card         from '../../../../components/ui/Card';
import Badge        from '../../../../components/ui/Badge';
import Button       from '../../../../components/ui/Button';
import Modal        from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import { Field, Input } from '../../../../components/ui/Input';
import { Upload, Trash2, X, Plus, FolderOpen, Edit2, ChevronUp, ChevronDown, Info } from 'lucide-react';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';
import { useDropzone } from 'react-dropzone';

// ── File type helpers ─────────────────────────────────────────
const EXT_TYPE = {
  mp4:'video', mov:'video', avi:'video', webm:'video',
  jpg:'image', jpeg:'image', png:'image', webp:'image', gif:'image',
  pdf:'pdf', pptx:'presentation', ppt:'presentation',
  doc:'document', docx:'document', xls:'spreadsheet', xlsx:'spreadsheet',
};
const fileType = (name) => EXT_TYPE[name?.split('.').pop()?.toLowerCase()] || 'other';
const isImage  = (name) => fileType(name) === 'image';

const TYPE_ICON = {
  video:'🎬', pdf:'📄', presentation:'📊', document:'📝', spreadsheet:'📗', other:'📎',
};
const typeIcon = (name) => TYPE_ICON[fileType(name)] || '📎';

// ── Thumbnail component ───────────────────────────────────────
// Images: actual preview using the proxy route /api/logo?path=...
// Others: large emoji icon centred in the same 44×44 box
function FileThumbnail({ file }) {
  const [imgErr, setImgErr] = useState(false);

  if (isImage(file.file_name) && !imgErr) {
    const rawPath = file.file_path || '';
    // Normalise: strip leading slash, ensure starts with 'uploads/'
    const clean = rawPath.replace(/^\/+/, '');
    const proxyUrl = `/api/logo?path=/${clean}`;
    return (
      <div style={{ width:44, height:44, borderRadius:6, overflow:'hidden',
                    border:'1px solid var(--border)', flexShrink:0 }}>
        <img
          src={proxyUrl}
          alt={file.file_name}
          style={{ width:44, height:44, objectFit:'cover', display:'block' }}
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }

  return (
    <div style={{ width:44, height:44, borderRadius:6, border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--bg-main)', fontSize:24, flexShrink:0 }}>
      {typeIcon(file.file_name)}
    </div>
  );
}

// ── Naming-convention help box ────────────────────────────────
function NamingHelp() {
  return (
    <div style={{ background:'#FFFBEB', border:'1px solid #F59E0B',
                  borderRadius:'var(--radius-sm)', padding:'12px 14px', fontSize:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontWeight:700,
                    color:'#B45309', marginBottom:8 }}>
        <Info size={13}/> Naming Convention Tip
      </div>
      <div style={{ color:'var(--text-body)', lineHeight:1.8 }}>
        Name your files in sequence for each TV so the player shows them in order:
      </div>
      <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
        {[
          { tv:'TV 1', eg:'tv1-001.jpg, tv1-002.jpg, tv1-003.jpg' },
          { tv:'TV 2', eg:'tv2-001.jpg, tv2-002.jpg, tv2-003.jpg' },
          { tv:'TV 3', eg:'tv3-001.jpg, tv3-002.jpg, tv3-003.jpg' },
        ].map(r => (
          <div key={r.tv} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ minWidth:32, fontWeight:700, color:'#B45309', fontSize:11 }}>{r.tv}</span>
            <code style={{ fontSize:11, background:'rgba(245,158,11,.12)',
                           padding:'2px 6px', borderRadius:4, color:'#92400E' }}>
              {r.eg}
            </code>
          </div>
        ))}
      </div>
      <div style={{ marginTop:8, color:'#78716C', fontSize:11, fontStyle:'italic' }}>
        Files play in alphabetical order on the TV — the numbering ensures correct sequence.
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminMediaPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const {
    data: foldersData, isLoading, page, setPage, total, totalPages,
  } = useServerPagination(['admin-folders'], getFolders, { limit: 12 });
  const folders = foldersData?.folders || [];

  const [activeFolder,    setActiveFolder]    = useState(null); // expanded folder name
  const [uploadModal,     setUploadModal]     = useState(false);
  const [addToFolder,     setAddToFolder]     = useState(null); // open upload directly to folder
  const [renameModal,     setRenameModal]     = useState(null); // { folder_name }
  const [deleteFolderM,   setDeleteFolderM]   = useState(null);
  const [deleteFileM,     setDeleteFileM]     = useState(null);
  const [previewFile,     setPreviewFile]     = useState(null);
  const [folderName,      setFolderName]      = useState('');
  const [newFolderName,   setNewFolderName]   = useState('');
  const [droppedFiles,    setDroppedFiles]    = useState([]);
  const [uploading,       setUploading]       = useState(false);
  const [reorderLoading,  setReorderLoading]  = useState(null); // file id

  // Full list (not paginated) — the ↑/↓ reorder buttons need every file in
  // the folder to compute correct sequence swaps, not just one page of them.
  const { data: filesData, refetch: refetchFiles } = useQuery({
    queryKey: ['admin-folder-files', activeFolder],
    queryFn:  () => getFolderFiles(activeFolder, { limit: 500 }),
    enabled:  !!activeFolder,
  });
  const folderFiles = (filesData?.files || []).sort((a, b) => (a.sequence||0) - (b.sequence||0));

  const onDrop = useCallback(a => setDroppedFiles(p => [...p, ...a]), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const invFolders = () => qc.invalidateQueries({ queryKey:['admin-folders'] });
  const invFiles   = () => qc.invalidateQueries({ queryKey:['admin-folder-files', activeFolder] });

  // ── Mutations ─────────────────────────────────────────────
  const delFileMut = useMutation({
    mutationFn: deleteMediaFile,
    onSuccess: () => { invFolders(); invFiles(); setDeleteFileM(null); toast('File deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const delFolderMut = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => { invFolders(); setDeleteFolderM(null); setActiveFolder(null); toast('Folder deleted'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const renameMut = useMutation({
    mutationFn: ({ oldName, newName }) => renameFolder(oldName, newName),
    onSuccess: (_, vars) => {
      invFolders();
      if (activeFolder === vars.oldName) setActiveFolder(vars.newName);
      setRenameModal(null);
      toast('Folder renamed');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  // ── Upload ────────────────────────────────────────────────
  const handleUpload = async () => {
    const target = addToFolder || folderName.trim();
    if (!target)       return toast('Enter a folder name', 'warning');
    if (!droppedFiles.length) return toast('Select files', 'warning');
    setUploading(true);
    try {
      await uploadFiles(target, droppedFiles);
      invFolders();
      qc.invalidateQueries({ queryKey:['admin-folder-files', target] });
      if (activeFolder === target) refetchFiles();
      setUploadModal(false);
      setAddToFolder(null);
      setFolderName('');
      setDroppedFiles([]);
      toast(`Uploaded ${droppedFiles.length} file(s) to "${target}"`);
    } catch (e) { toast(e.message, 'danger'); }
    finally { setUploading(false); }
  };

  // ── Reorder ───────────────────────────────────────────────
  const moveFile = async (fileId, direction) => {
    const idx = folderFiles.findIndex(f => f.id === fileId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= folderFiles.length) return;

    const newOrder = folderFiles.map((f, i) => {
      if (i === idx)     return { id: f.id, sequence: folderFiles[swapIdx].sequence };
      if (i === swapIdx) return { id: f.id, sequence: folderFiles[idx].sequence };
      return { id: f.id, sequence: f.sequence };
    });

    setReorderLoading(fileId);
    try {
      await reorderFiles(newOrder);
      invFiles();
    } catch (e) { toast(e.message, 'danger'); }
    finally { setReorderLoading(null); }
  };

  const openAddFiles = (fn) => {
    setAddToFolder(fn); setFolderName(fn); setDroppedFiles([]);
    setUploadModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Media Bucket</h2>
          <p>{total} folder{total!==1?'s':''}</p>
        </div>
        <Button variant="primary" onClick={() => {
          setAddToFolder(null); setFolderName(''); setDroppedFiles([]);
          setUploadModal(true);
        }}>
          <Plus size={16}/> Upload Files
        </Button>
      </div>

      {/* ── Folder grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14, marginBottom:24 }}>
        {isLoading && [...Array(4)].map((_,i) => (
          <div key={i} className="skeleton" style={{ height:110, borderRadius:'var(--radius-lg)' }}/>
        ))}
        {folders.map(folder => (
          <Card key={folder.folder_name} flat
            style={{ cursor:'pointer', borderColor: activeFolder===folder.folder_name ? 'var(--primary)' : undefined,
                     background: activeFolder===folder.folder_name ? 'var(--primary-10)' : 'white' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ width:40, height:40, borderRadius:'var(--radius-md)',
                            background: activeFolder===folder.folder_name ? 'var(--primary)' : 'var(--primary-10)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                📁
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <Button variant="ghost" size="sm" title="Add files"
                  onClick={e => { e.stopPropagation(); openAddFiles(folder.folder_name); }}>
                  <Plus size={13} color="var(--primary)"/>
                </Button>
                <Button variant="ghost" size="sm" title="Rename"
                  onClick={e => { e.stopPropagation(); setRenameModal(folder); setNewFolderName(folder.folder_name); }}>
                  <Edit2 size={13} color="var(--text-muted)"/>
                </Button>
                <Button variant="ghost" size="sm" title="Delete folder"
                  onClick={e => { e.stopPropagation(); setDeleteFolderM(folder); }}>
                  <Trash2 size={13} color="var(--danger)"/>
                </Button>
              </div>
            </div>
            <div onClick={() => setActiveFolder(activeFolder===folder.folder_name ? null : folder.folder_name)}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text-heading)', marginBottom:3 }}>
                {folder.folder_name}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                {folder.file_count} file{folder.file_count!==1?'s':''} · {fmt.bytes(folder.total_size_mb||0)}
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && folders.length === 0 && (
          <div style={{ gridColumn:'1/-1' }}>
            <Card>
              <div className="empty">
                <div className="empty__icon"><FolderOpen size={40} color="var(--text-muted)"/></div>
                <div className="empty__title">No folders yet</div>
                <Button variant="primary" onClick={() => setUploadModal(true)} style={{ marginTop:12 }}>
                  <Upload size={14}/> Upload Your First Files
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={12} onPage={setPage} />

      {/* ── Expanded folder: file table ── */}
      {activeFolder && (
        <Card title={`📂 ${activeFolder}`}
          action={
            <Button variant="secondary" size="sm" onClick={() => openAddFiles(activeFolder)}>
              <Plus size={13}/> Add Files
            </Button>
          }>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width:36 }}>#</th>
                  {/* 1. PREVIEW COLUMN */}
                  <th style={{ width:60 }}>Preview</th>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  {/* 2. ORDER COLUMN */}
                  <th style={{ width:80 }}>Order</th>
                  <th style={{ width:60 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {folderFiles.map((file, idx) => (
                  <tr key={file.id}>
                    {/* # */}
                    <td style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textAlign:'center' }}>
                      {idx + 1}
                    </td>

                    {/* Preview — click to enlarge image */}
                    <td>
                      <div
                        style={{ cursor: isImage(file.file_name) ? 'pointer' : 'default' }}
                        onClick={() => isImage(file.file_name) && setPreviewFile(file)}
                      >
                        <FileThumbnail file={file}/>
                      </div>
                    </td>

                    {/* File name */}
                    <td>
                      <div className="table__name" style={{ maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {file.file_name}
                      </div>
                    </td>

                    {/* Type */}
                    <td><Badge variant="primary">{file.file_type}</Badge></td>

                    {/* Size */}
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.bytes(file.file_size_mb||0)}</td>

                    {/* Uploaded */}
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(file.created_at)}</td>

                    {/* Order ↑ ↓ */}
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button
                          disabled={idx === 0 || reorderLoading === file.id}
                          onClick={() => moveFile(file.id, 'up')}
                          style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--border)',
                                   background:'white', cursor: idx===0 ? 'not-allowed' : 'pointer',
                                   display:'flex', alignItems:'center', justifyContent:'center',
                                   opacity: idx===0 ? 0.3 : 1 }}>
                          <ChevronUp size={13}/>
                        </button>
                        <button
                          disabled={idx === folderFiles.length-1 || reorderLoading === file.id}
                          onClick={() => moveFile(file.id, 'down')}
                          style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--border)',
                                   background:'white', cursor: idx===folderFiles.length-1 ? 'not-allowed' : 'pointer',
                                   display:'flex', alignItems:'center', justifyContent:'center',
                                   opacity: idx===folderFiles.length-1 ? 0.3 : 1 }}>
                          <ChevronDown size={13}/>
                        </button>
                      </div>
                    </td>

                    {/* Action */}
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteFileM(file)}>
                        <Trash2 size={13} color="var(--danger)"/>
                      </Button>
                    </td>
                  </tr>
                ))}
                {folderFiles.length === 0 && (
                  <tr><td colSpan={8}>
                    <div className="empty" style={{ padding:'24px 0' }}>
                      <div className="empty__title">No files in this folder</div>
                      <Button variant="primary" size="sm" style={{ marginTop:10 }}
                        onClick={() => openAddFiles(activeFolder)}>
                        <Plus size={13}/> Add Files
                      </Button>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Upload Modal ── */}
      <Modal
        open={uploadModal}
        onClose={() => { setUploadModal(false); setAddToFolder(null); setFolderName(''); setDroppedFiles([]); }}
        title={addToFolder ? `Add Files to "${addToFolder}"` : 'Upload Files'}
        footer={<>
          <Button variant="secondary" onClick={() => { setUploadModal(false); setAddToFolder(null); setFolderName(''); setDroppedFiles([]); }}>
            Cancel
          </Button>
          <Button variant="primary" loading={uploading} onClick={handleUpload}>
            <Upload size={14}/> Upload {droppedFiles.length > 0 ? `(${droppedFiles.length})` : ''}
          </Button>
        </>}>
        <div className="form-grid">

          {/* Folder name */}
          <Field label={addToFolder ? 'Folder' : 'Folder Name *'}
            hint={addToFolder ? `Files will be added to "${addToFolder}"` : 'Create a new folder or type an existing name'}>
            {addToFolder ? (
              <div style={{ padding:'10px 14px', background:'var(--primary-10)', border:'1px solid var(--primary)',
                            borderRadius:'var(--radius-sm)', fontWeight:700, color:'var(--primary)', fontSize:14,
                            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>📁 {addToFolder}</span>
                <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)' }}>locked</span>
              </div>
            ) : (
              <Input
                placeholder="e.g. jio-promo-june"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
              />
            )}
          </Field>

          {/* 4. NAMING CONVENTION HELP */}
          <NamingHelp/>

          {/* Dropzone */}
          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)', padding: 28, textAlign:'center',
            cursor:'pointer', background: isDragActive ? 'var(--primary-10)' : 'var(--bg-main)',
            transition:'all .18s',
          }}>
            <input {...getInputProps()}/>
            <div style={{ fontSize:32, marginBottom:8 }}>📥</div>
            <p style={{ fontWeight:600, fontSize:14 }}>
              {isDragActive ? 'Drop files here...' : 'Drag files or click to browse'}
            </p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
              jpg · png · mp4 · pdf · pptx · doc
            </p>
          </div>

          {/* File list */}
          {droppedFiles.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {droppedFiles.map((f, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                                      background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:13 }}>
                  <span style={{ fontSize:18 }}>{typeIcon(f.name)}</span>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                  <span style={{ color:'var(--text-muted)', fontSize:11, flexShrink:0 }}>
                    {(f.size/1024/1024).toFixed(1)} MB
                  </span>
                  <button onClick={() => setDroppedFiles(p => p.filter((_,j) => j!==i))}
                    style={{ color:'var(--danger)', background:'none', border:'none', cursor:'pointer' }}>
                    <X size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Rename Modal ── */}
      <Modal open={!!renameModal} onClose={() => setRenameModal(null)} title="Rename Folder" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setRenameModal(null)}>Cancel</Button>
          <Button variant="primary" loading={renameMut.isPending}
            onClick={() => renameMut.mutate({ oldName: renameModal.folder_name, newName: newFolderName.trim() })}>
            Rename
          </Button>
        </>}>
        <Field label="New Folder Name">
          <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}/>
        </Field>
      </Modal>

      {/* ── Image Lightbox ── */}
      {previewFile && (
        <div onClick={() => setPreviewFile(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:1000,
                   display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginBottom:10 }}>{previewFile.file_name}</div>
          <img
            src={`/api/logo?path=/${previewFile.file_path.replace(/^\/+/,'')}`}
            alt={previewFile.file_name}
            style={{ maxWidth:'88vw', maxHeight:'82vh', borderRadius:10, objectFit:'contain', boxShadow:'0 8px 40px rgba(0,0,0,.6)' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop:14, fontSize:12, color:'rgba(255,255,255,.4)' }}>Click anywhere to close</div>
        </div>
      )}

      <ConfirmModal open={!!deleteFileM} onClose={() => setDeleteFileM(null)}
        title="Delete File" message={`Delete "${deleteFileM?.file_name}"?`}
        loading={delFileMut.isPending} onConfirm={() => delFileMut.mutate(deleteFileM.id)}/>

      <ConfirmModal open={!!deleteFolderM} onClose={() => setDeleteFolderM(null)}
        title="Delete Folder"
        message={`Delete folder "${deleteFolderM?.folder_name}" and ALL its files? This cannot be undone.`}
        loading={delFolderMut.isPending} onConfirm={() => delFolderMut.mutate(deleteFolderM.folder_name)}/>
    </div>
  );
}