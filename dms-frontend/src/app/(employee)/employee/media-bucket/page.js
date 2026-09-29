'use client';
// src/app/(employee)/employee/media-bucket/page.js
// UPDATED: Full feature parity with admin media bucket
//  1. Order ↑↓ buttons instead of Eye preview icon in table actions
//  2. "Add Files" (+) button per folder card (opens upload modal scoped to that folder)
//  3. NamingHelp yellow box inline in upload modal (replaces separate help modal)
//  4. Removed image strip above table — preview is only in the table thumbnail column
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFolders, getFolderFiles, uploadFiles, deleteMediaFile,
  deleteFolder, renameFolder, reorderFiles,
} from '../../../../lib/api';
import { fmt, thumbUrl } from '../../../../lib/utils';
import { useToast } from '../../../../components/ui/Toast';
import Card         from '../../../../components/ui/Card';
import Button       from '../../../../components/ui/Button';
import Modal        from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import Pagination   from '../../../../components/ui/Pagination';
import Badge        from '../../../../components/ui/Badge';
import { Field, Input } from '../../../../components/ui/Input';
import { Upload, Trash2, Edit2, X, Plus, Info, ChevronUp, ChevronDown, FolderOpen } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import useServerPagination from '../../../../hooks/useServerPagination';

// ── Constants ─────────────────────────────────────────────────
const FILE_ICON   = { video:'🎬', image:'🖼️', pdf:'📄', presentation:'📊', other:'📎' };
const PAGE_SIZE      = 12;
const FILE_PAGE_SIZE = 20;

// ── File type helpers ─────────────────────────────────────────
const EXT_TYPE = {
  mp4:'video', mov:'video', avi:'video', webm:'video',
  jpg:'image', jpeg:'image', png:'image', webp:'image', gif:'image',
  pdf:'pdf', pptx:'presentation', ppt:'presentation',
  doc:'document', docx:'document', xls:'spreadsheet', xlsx:'spreadsheet',
};
const fileType = (name) => EXT_TYPE[name?.split('.').pop()?.toLowerCase()] || 'other';
const isImage  = (name) => fileType(name) === 'image';
const typeIcon = (name) => FILE_ICON[fileType(name)] || '📎';

// ── Thumbnail (table cell) ────────────────────────────────────
function FileThumbnail({ file, onClick }) {
  const [imgErr, setImgErr] = useState(false);

  if (isImage(file.file_name) && !imgErr) {
    return (
      <div
        onClick={onClick}
        style={{ width:44, height:44, borderRadius:6, overflow:'hidden',
                 cursor:'pointer', border:'1px solid var(--border)', flexShrink:0 }}
      >
        <img
          src={thumbUrl(file.file_path)}
          alt={file.file_name}
          style={{ width:'100%', height:'100%', objectFit:'cover' }}
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }

  return (
    <div style={{ width:44, height:44, borderRadius:6, border:'1px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:'var(--bg-main)', fontSize:20, flexShrink:0 }}>
      {typeIcon(file.file_name)}
    </div>
  );
}

// ── Naming convention help box (same as admin) ────────────────
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
export default function EmployeeMediaBucket() {
  const toast = useToast();
  const qc    = useQueryClient();
  const inv   = () => qc.invalidateQueries({ queryKey:['emp-folders'] });

  const {
    data: foldersData, isLoading, page, setPage, total, totalPages,
  } = useServerPagination(['emp-folders'], getFolders, { limit: PAGE_SIZE });
  const folders = foldersData?.folders || [];
  const paged   = folders;

  // Folder expand + file pagination
  const [expandFolder, setExpandFolder] = useState(null);
  const [filePage, setFilePage]         = useState(1);

  // Upload modal
  const [uploadModal,  setUploadModal]  = useState(false);
  const [addToFolder,  setAddToFolder]  = useState(null);
  const [folderName,   setFolderName]   = useState('');
  const [files,        setFiles]        = useState([]);
  const [uploading,    setUploading]    = useState(false);

  // Rename modal
  const [renameModal,     setRenameModal]     = useState(null); // folder_name string
  const [newFolderName,   setNewFolderName]   = useState('');
  const [renamingFolder,  setRenamingFolder]  = useState(false);

  // Delete modals
  const [deleteFileM,   setDeleteFileM]   = useState(null);
  const [deleteFolderM, setDeleteFolderM] = useState(null);

  // Image lightbox
  const [previewFile, setPreviewFile] = useState(null);

  // Reorder loading state
  const [reorderLoading, setReorderLoading] = useState(null); // file id

  // Folder files query — fetched in full (not server-paginated); the ↑/↓
  // reorder buttons need every file to compute correct sequence swaps, and
  // this page already does its own client-side windowing for display below.
  const { data: filesData } = useQuery({
    queryKey: ['emp-folder-files', expandFolder],
    queryFn:  () => getFolderFiles(expandFolder, { limit: 500 }),
    enabled:  !!expandFolder,
  });
  const allFolderFiles = (filesData?.files || []).sort((a,b) => (a.sequence||0) - (b.sequence||0));
  const totalFilePages = Math.ceil(allFolderFiles.length / FILE_PAGE_SIZE);
  const folderFiles    = allFolderFiles.slice((filePage-1)*FILE_PAGE_SIZE, filePage*FILE_PAGE_SIZE);

  // Dropzone
  const onDrop = useCallback(a => setFiles(p => [...p, ...a]), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // ── Helpers ──────────────────────────────────────────────
  const invFiles = () => qc.invalidateQueries({ queryKey:['emp-folder-files', expandFolder] });

  const openAddFiles = (fn) => {
    setAddToFolder(fn);
    setFolderName(fn);
    setFiles([]);
    setUploadModal(true);
  };

  // ── Mutations ─────────────────────────────────────────────
  const delFileMut = useMutation({
    mutationFn: deleteMediaFile,
    onSuccess: () => {
      inv(); invFiles(); setDeleteFileM(null); toast('File deleted');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const delFolderMut = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      inv(); setDeleteFolderM(null); setExpandFolder(null); toast('Folder deleted');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  // ── Upload ────────────────────────────────────────────────
  const handleUpload = async () => {
    const target = addToFolder || folderName.trim();
    if (!target)       return toast('Enter folder name', 'warning');
    if (!files.length) return toast('Select files', 'warning');
    setUploading(true);
    try {
      await uploadFiles(target, files);
      inv();
      qc.invalidateQueries({ queryKey:['emp-folder-files', target] });
      setUploadModal(false);
      setFolderName('');
      setAddToFolder(null);
      setFiles([]);
      toast(`✅ Uploaded ${files.length} file(s) to "${target}"`);
    } catch (e) { toast(e.message, 'danger'); }
    finally { setUploading(false); }
  };

  // ── Rename ────────────────────────────────────────────────
  const handleRename = async () => {
    if (!newFolderName.trim()) return toast('Enter a folder name', 'warning');
    setRenamingFolder(true);
    try {
      await renameFolder(renameModal, newFolderName.trim());
      inv();
      if (expandFolder === renameModal) setExpandFolder(newFolderName.trim());
      setRenameModal(null);
      setNewFolderName('');
      toast('Folder renamed');
    } catch (e) { toast(e.message, 'danger'); }
    finally { setRenamingFolder(false); }
  };

  // ── Reorder (↑ ↓ buttons, same as admin) ─────────────────
  const moveFile = async (fileId, direction) => {
    const idx = allFolderFiles.findIndex(f => f.id === fileId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= allFolderFiles.length) return;

    const newOrder = allFolderFiles.map((f, i) => {
      if (i === idx)     return { id: f.id, sequence: allFolderFiles[swapIdx].sequence };
      if (i === swapIdx) return { id: f.id, sequence: allFolderFiles[idx].sequence };
      return { id: f.id, sequence: f.sequence };
    });

    setReorderLoading(fileId);
    try {
      await reorderFiles(newOrder);
      invFiles();
    } catch (e) { toast(e.message, 'danger'); }
    finally { setReorderLoading(null); }
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Media Bucket</h2>
          <p>{total} folder{total !== 1 ? 's' : ''} · your personal library</p>
        </div>
        <Button variant="primary" onClick={() => {
          setAddToFolder(null); setFiles([]); setFolderName(''); setUploadModal(true);
        }}>
          <Plus size={16}/> Upload Files
        </Button>
      </div>

      {/* ── Folder grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
        {isLoading && [...Array(4)].map((_,i) => (
          <div key={i} className="skeleton" style={{ height:130, borderRadius:'var(--radius-lg)' }}/>
        ))}

        {paged.map(folder => (
          <Card key={folder.folder_name} flat
            style={{
              cursor: 'pointer',
              borderColor: expandFolder === folder.folder_name ? 'var(--primary)' : undefined,
              background:  expandFolder === folder.folder_name ? 'var(--primary-10)' : 'white',
            }}>
            {/* Card header: icon + action buttons */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ width:40, height:40, borderRadius:'var(--radius-md)',
                            background: expandFolder === folder.folder_name ? 'var(--primary)' : 'var(--primary-10)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                📁
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {/* 2. ADD FILES button per folder card */}
                <Button variant="ghost" size="sm" title="Add files"
                  onClick={e => { e.stopPropagation(); openAddFiles(folder.folder_name); }}>
                  <Plus size={13} color="var(--primary)"/>
                </Button>
                <Button variant="ghost" size="sm" title="Rename"
                  onClick={e => { e.stopPropagation(); setRenameModal(folder.folder_name); setNewFolderName(folder.folder_name); }}>
                  <Edit2 size={13} color="var(--text-muted)"/>
                </Button>
                <Button variant="ghost" size="sm" title="Delete folder"
                  onClick={e => { e.stopPropagation(); setDeleteFolderM(folder); }}>
                  <Trash2 size={13} color="var(--danger)"/>
                </Button>
              </div>
            </div>

            {/* Folder name + meta — click to expand */}
            <div onClick={() => {
              setExpandFolder(expandFolder === folder.folder_name ? null : folder.folder_name);
              setFilePage(1);
            }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text-heading)', marginBottom:3 }}>
                {folder.folder_name}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                {folder.file_count} file{folder.file_count !== 1 ? 's' : ''} · {fmt.bytes(folder.total_size_mb || 0)}
              </div>
            </div>
          </Card>
        ))}

        {!isLoading && folders.length === 0 && (
          <Card style={{ gridColumn:'1/-1' }}>
            <div className="empty">
              <div className="empty__icon"><FolderOpen size={40} color="var(--text-muted)"/></div>
              <div className="empty__title">No folders yet</div>
              <p style={{ marginBottom:16 }}>Upload your first files to get started</p>
              <Button variant="primary" onClick={() => {
                setAddToFolder(null); setFiles([]); setFolderName(''); setUploadModal(true);
              }}>
                <Upload size={14}/> Upload Files
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPage={setPage}/>

      {/* ── Expanded folder: file table ── */}
      {expandFolder && (
        <Card
          title={`📂 ${expandFolder}`}
          style={{ marginTop:20 }}
          action={
            <Button variant="secondary" size="sm" onClick={() => openAddFiles(expandFolder)}>
              <Plus size={13}/> Add Files
            </Button>
          }
        >
          {/* 4. NO image strip here — preview is only inside the table */}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width:36 }}>#</th>
                  <th style={{ width:60 }}>Preview</th>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  {/* 1. ORDER column instead of separate eye icon */}
                  <th style={{ width:80 }}>Order</th>
                  <th style={{ width:60 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {folderFiles.map((f, idx) => {
                  const absoluteIdx = (filePage - 1) * FILE_PAGE_SIZE + idx;
                  return (
                    <tr key={f.id}>
                      {/* # */}
                      <td style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textAlign:'center' }}>
                        {absoluteIdx + 1}
                      </td>

                      {/* Preview thumbnail — click image to open lightbox */}
                      <td>
                        <FileThumbnail
                          file={f}
                          onClick={() => isImage(f.file_name) && setPreviewFile(f)}
                        />
                      </td>

                      {/* File name */}
                      <td>
                        <div style={{ fontWeight:600, fontSize:13, maxWidth:220,
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {f.file_name}
                        </div>
                      </td>

                      {/* Type badge */}
                      <td>
                        <Badge variant={
                          f.file_type === 'video'  ? 'primary' :
                          f.file_type === 'image'  ? 'success' :
                          f.file_type === 'pdf'    ? 'danger'  : 'warning'
                        }>
                          {f.file_type}
                        </Badge>
                      </td>

                      {/* Size */}
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {fmt.bytes(f.file_size_mb || 0)}
                      </td>

                      {/* Uploaded */}
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {fmt.ago(f.created_at)}
                      </td>

                      {/* 1. ORDER ↑ ↓ buttons — identical to admin */}
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button
                            disabled={absoluteIdx === 0 || reorderLoading === f.id}
                            onClick={() => moveFile(f.id, 'up')}
                            style={{ width:28, height:28, borderRadius:6,
                                     border:'1px solid var(--border)', background:'white',
                                     cursor: absoluteIdx === 0 ? 'not-allowed' : 'pointer',
                                     display:'flex', alignItems:'center', justifyContent:'center',
                                     opacity: absoluteIdx === 0 ? 0.3 : 1 }}>
                            <ChevronUp size={13}/>
                          </button>
                          <button
                            disabled={absoluteIdx === allFolderFiles.length - 1 || reorderLoading === f.id}
                            onClick={() => moveFile(f.id, 'down')}
                            style={{ width:28, height:28, borderRadius:6,
                                     border:'1px solid var(--border)', background:'white',
                                     cursor: absoluteIdx === allFolderFiles.length - 1 ? 'not-allowed' : 'pointer',
                                     display:'flex', alignItems:'center', justifyContent:'center',
                                     opacity: absoluteIdx === allFolderFiles.length - 1 ? 0.3 : 1 }}>
                            <ChevronDown size={13}/>
                          </button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteFileM(f)}>
                          <Trash2 size={13} color="var(--danger)"/>
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {allFolderFiles.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty" style={{ padding:'24px 0' }}>
                        <div className="empty__title">No files in this folder</div>
                        <Button variant="primary" size="sm" style={{ marginTop:10 }}
                          onClick={() => openAddFiles(expandFolder)}>
                          <Plus size={13}/> Add Files
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={filePage}
            totalPages={totalFilePages}
            total={allFolderFiles.length}
            pageSize={FILE_PAGE_SIZE}
            onPage={setFilePage}
          />
        </Card>
      )}

      {/* ── Upload Modal ── */}
      <Modal
        open={uploadModal}
        onClose={() => { setUploadModal(false); setAddToFolder(null); setFolderName(''); setFiles([]); }}
        title={addToFolder ? `Add Files to "${addToFolder}"` : 'Upload Files'}
        footer={<>
          <Button variant="secondary"
            onClick={() => { setUploadModal(false); setAddToFolder(null); setFolderName(''); setFiles([]); }}>
            Cancel
          </Button>
          <Button variant="primary" loading={uploading} onClick={handleUpload}>
            <Upload size={14}/> Upload {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </>}
      >
        <div className="form-grid">

          {/* Folder field */}
          <Field
            label={addToFolder ? 'Folder' : 'Folder Name *'}
            hint={addToFolder ? `Files will be added to "${addToFolder}"` : 'Create a new folder or type an existing name'}
          >
            {addToFolder ? (
              <div style={{ padding:'10px 14px', background:'var(--primary-10)',
                            border:'1px solid var(--primary)', borderRadius:'var(--radius-sm)',
                            fontWeight:700, color:'var(--primary)', fontSize:14,
                            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>📁 {addToFolder}</span>
                <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)' }}>locked</span>
              </div>
            ) : (
              <Input
                placeholder="e.g. tv1-promo-july"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
              />
            )}
          </Field>

          {/* 3. Naming convention help box — inline, same as admin */}
          <NamingHelp/>

          {/* Dropzone */}
          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)', padding:28, textAlign:'center',
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

          {/* Staged file list */}
          {files.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {files.map((f, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                                      background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:13 }}>
                  <span style={{ fontSize:18 }}>{typeIcon(f.name)}</span>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                  <span style={{ color:'var(--text-muted)', fontSize:11, flexShrink:0 }}>
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
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
      <Modal
        open={!!renameModal}
        onClose={() => setRenameModal(null)}
        title="Rename Folder"
        size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setRenameModal(null)}>Cancel</Button>
          <Button variant="primary" loading={renamingFolder} onClick={handleRename}>
            <Edit2 size={14}/> Rename
          </Button>
        </>}
      >
        <Field label="New Folder Name *">
          <Input
            placeholder="New folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
          />
        </Field>
      </Modal>

      {/* ── Image lightbox ── */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:1000,
                   display:'flex', flexDirection:'column', alignItems:'center',
                   justifyContent:'center', padding:24 }}
        >
          <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginBottom:10 }}>
            {previewFile.file_name}
          </div>
          <img
            src={thumbUrl(previewFile.file_path)}
            alt={previewFile.file_name}
            style={{ maxWidth:'88vw', maxHeight:'82vh', borderRadius:10,
                     objectFit:'contain', boxShadow:'0 8px 40px rgba(0,0,0,.6)' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop:14, fontSize:12, color:'rgba(255,255,255,.4)' }}>
            Click anywhere to close
          </div>
        </div>
      )}

      {/* ── Confirm modals ── */}
      <ConfirmModal
        open={!!deleteFileM}
        onClose={() => setDeleteFileM(null)}
        title="Delete File"
        message={`Delete "${deleteFileM?.file_name}"?`}
        loading={delFileMut.isPending}
        onConfirm={() => delFileMut.mutate(deleteFileM.id)}
      />
      <ConfirmModal
        open={!!deleteFolderM}
        onClose={() => setDeleteFolderM(null)}
        title="Delete Folder"
        message={`Delete folder "${deleteFolderM?.folder_name}" and ALL its files? This cannot be undone.`}
        loading={delFolderMut.isPending}
        onConfirm={() => delFolderMut.mutate(deleteFolderM.folder_name)}
      />
    </div>
  );
}