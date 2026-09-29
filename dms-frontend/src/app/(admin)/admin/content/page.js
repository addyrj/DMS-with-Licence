'use client';
// src/app/(admin)/admin/content/page.js
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContent, getContentFiles, setDuration, deleteContentFile,
  getLines, getDisplays, getFolders, getFolderFiles,
  publishContent, unpublishContent, getPublishStatus, republishContent, deletePublishedContent, deletePublishHistory,
  uploadFiles as uploadFilesApi, getContentByLine, directUpload,
  getAssignments, toggleAssignment, deleteAssignment, createAssignment,
  getPublishHistory, getDisplayErrors,
} from '../../../../lib/api';
import { fmt, thumbUrl, isDocType } from '../../../../lib/utils';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import ProgressBar from '../../../../components/ui/ProgressBar';
import { Field, Input, Select } from '../../../../components/ui/Input';
import { useToast } from '../../../../components/ui/Toast';
import { Send, ChevronDown, ChevronUp, Trash2, Clock, Monitor, AlertTriangle, Tv } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import usePagination from '../../../../hooks/usePagination';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';
import FilePreview from '../../../../components/ui/FilePreview';

// 'Upload New' tab restored per request
const PUB_TABS  = ['From Library', 'Upload New', 'Direct TV Upload'];
const FILE_ICON = { video:'🎬', image:'🖼️', pdf:'📄', presentation:'📊' };

function TvCard({ tv }) {
  const [imgErr, setImgErr] = useState({});
  return (
    <div style={{ background:'white', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background: tv.status==='ONLINE'?'var(--success)':'var(--danger)', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tv.display_name}</div>
          <code style={{ fontSize:11, color:'var(--text-muted)' }}>{tv.display_number}</code>
        </div>
        <Badge variant={tv.status==='ONLINE'?'success':'danger'}>{tv.status}</Badge>
      </div>
      <div style={{ flex:1, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
        {tv.files.length === 0
          ? <div style={{ textAlign:'center', padding:'16px 0', color:'var(--text-muted)', fontSize:12 }}>No content published</div>
          : tv.files.map((f, idx) => (
            <div key={f.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>{idx+1}</div>
              {f.file_type==='image' && thumbUrl(f.file_path) && !imgErr[f.id]
                ? <div style={{ width:34, height:34, borderRadius:4, overflow:'hidden', flexShrink:0 }}><img src={thumbUrl(f.file_path)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={()=>setImgErr(p=>({...p,[f.id]:true}))}/></div>
                : <span style={{ fontSize:16, flexShrink:0 }}>{FILE_ICON[f.file_type]||'📄'}</span>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.file_name}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)' }}>{isDocType(f.file_name)?`${f.duration||50}s/pg`:`${f.duration||10}s`}</div>
              </div>
            </div>
          ))}
      </div>
      <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)', display:'flex', justifyContent:'space-between' }}>
        <span>{tv.files.length} file{tv.files.length!==1?'s':''}</span>
        {tv.last_heartbeat && <span>{fmt.ago(tv.last_heartbeat)}</span>}
      </div>
    </div>
  );
}

export default function ContentPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const {
    data: contentData, page: contentPage, setPage: setContentPage,
    total: contentTotal, totalPages: contentTotalPages,
  } = useServerPagination(['content'], getContent, { limit: 15 });
  const {
    data: histData, page: histPage, setPage: setHistPage,
    total: histTotal, totalPages: histTotalPages,
  } = useServerPagination(['publish-history'], getPublishHistory, { limit: 10 });

  // Dropdown/picker sources need the full sets, not one page.
  const { data: linesData   } = useQuery({ queryKey:['lines-all'],    queryFn: () => getLines({ limit: 500 }) });
  const { data: foldersData } = useQuery({ queryKey:['folders-all'],  queryFn: () => getFolders({ limit: 500 }) });
  const { data: displaysData} = useQuery({ queryKey:['displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  // NOTE: assignments are fetched here but not rendered anywhere on this page
  // (pre-existing dead code — left untouched, not part of this pagination pass).
  const { data: asgData, refetch: refetchAsg } = useQuery({ queryKey:['assignments'], queryFn: getAssignments });

  const _allContent     = (contentData?.content     || []).filter(Boolean);
  const _allAssignments = (asgData?.assignments      || []).filter(Boolean);
  const content         = _allContent;
  const publishHistory  = (histData?.history || []).filter(Boolean);
  const { paged: assignments, Pager: AsgPager } = usePagination(_allAssignments, 15);

  const lines       = (linesData?.lines     || []).filter(Boolean);
  const folders     = (foldersData?.folders  || []).filter(Boolean);
  const allDisplays = (displaysData?.displays|| []).filter(Boolean);

  // ── State ──
  const [viewMode,    setViewMode]    = useState('table');
  const [selLine,     setSelLine]     = useState('');
  const [expId,       setExpId]       = useState(null);
  const [expHistId,   setExpHistId]   = useState(null);
  const [editDurId,   setEditDurId]   = useState(null);
  const [newDur,      setNewDur]      = useState('');
  const [editDocDurId,setEditDocDurId]= useState(null);
  const [newDocDur,   setNewDocDur]   = useState('');
  const [delFileM,    setDelFileM]    = useState(null);
  const [delAsgM,     setDelAsgM]     = useState(null);
  const [statLine,    setStatLine]    = useState(null);
  const [pubModal,    setPubModal]    = useState(false);
  const [pubTab,      setPubTab]      = useState('From Library');
  const [pubLineMode, setPubLineMode] = useState('one');
  const [pubLineId,   setPubLineId]   = useState('');
  const [pubDispMode, setPubDispMode] = useState('all');
  const [pubSelDisps, setPubSelDisps] = useState([]);
  const [pubFolder,   setPubFolder]   = useState('');
  const [selFiles,    setSelFiles]    = useState([]);
  const [fileRepeats, setFileRepeats] = useState({});
  const [upFiles,     setUpFiles]     = useState([]);
  const [upFolder,    setUpFolder]    = useState('');

  // Matches the backend's own normalization (folder_name.toLowerCase().trim()
  // in publish.service.js) so this only fires when the backend would
  // genuinely treat it as the same folder — not just a visual near-match.
  const upFolderMatch = (() => {
    const norm = upFolder.trim().toLowerCase();
    if (!norm) return null;
    return folders.find(f => (f.folder_name||'').trim().toLowerCase() === norm) || null;
  })();
  // Direct TV Upload — no production line dropdown anymore
  const [dtDispNum,   setDtDispNum]   = useState('');
  const [dtFiles,     setDtFiles]     = useState([]);
  const [pubDur,      setPubDur]      = useState('10');
  const [pubDocDur,   setPubDocDur]   = useState('50');
  const [uploading,   setUploading]   = useState(false);
  const [appendMode,  setAppendMode]  = useState(false);   // From Library append toggle
  const [dtAppendMode,setDtAppendMode]= useState(false);   // Direct TV Upload append toggle
  const [previewFile, setPreviewFile] = useState(null);
  const [newAsgModal, setNewAsgModal] = useState(false);
  const [asgFolder,   setAsgFolder]   = useState('');
  const [asgFileId,   setAsgFileId]   = useState('');
  const [asgDispId,   setAsgDispId]   = useState('');
  const [asgDur,      setAsgDur]      = useState('10');
  const [creatingAsg, setCreatingAsg] = useState(false);

  const expContent   = _allContent.find(x => x && x.id === expId);
  const expDisplayId = expContent?.display_id;
  const { data: errData } = useQuery({
    queryKey: ['display-errors', expDisplayId],
    queryFn:  () => getDisplayErrors(expDisplayId, { limit: 100 }),
    enabled:  !!expDisplayId,
    staleTime: 30000,
  });
  const errFiles = new Set(
    (errData?.errors || [])
      .map(e => {
        if (!e?.error_message) return '';
        const m = e.error_message.match(/([^/\s]+\.[a-z0-9]+)/i);
        return m ? m[1].toLowerCase() : '';
      })
      .filter(Boolean)
  );

  const displaysInLine = (() => {
    if (pubLineMode==='all') return allDisplays;
    if (!pubLineId) return [];
    const line = lines.find(l=>String(l.id)===String(pubLineId));
    if (!line) return [];
    const nums = (line.display_numbers||'').split(',').map(s=>s.trim()).filter(Boolean);
    return nums.length ? allDisplays.filter(d=>nums.includes(d.display_number)) : allDisplays;
  })();

  const onDropUp = useCallback(a=>setUpFiles(p=>[...p,...a]),[]);
  const { getRootProps:getUpRootProps, getInputProps:getUpInputProps, isDragActive:isUpDrag } = useDropzone({ onDrop: onDropUp });

  const onDropDt = useCallback(a=>setDtFiles(p=>[...p,...a]),[]);
  const { getRootProps:getDtRootProps, getInputProps:getDtInputProps, isDragActive:isDtDrag } = useDropzone({ onDrop: onDropDt });

  const { data: cardData, isLoading: cardLoading } = useQuery({
    queryKey:['content-by-line', selLine], queryFn:()=>getContentByLine(selLine, { limit: 100 }), enabled:!!selLine&&viewMode==='cards',
  });
  const tvCards = cardData?.tvs || [];

  const { data: folderFilesData } = useQuery({
    queryKey:['pub-folder', pubFolder], queryFn:()=>getFolderFiles(pubFolder, { limit: 500 }), enabled:!!pubFolder&&pubTab==='From Library',
  });
  const folderFiles = folderFilesData?.files || [];

  const { data: asgFolderData } = useQuery({
    queryKey:['asg-folder', asgFolder], queryFn:()=>getFolderFiles(asgFolder, { limit: 500 }), enabled:!!asgFolder&&newAsgModal,
  });
  const asgFolderFiles = asgFolderData?.files || [];
  const hasDocFiles = folderFiles.some(f=>isDocType(f.file_name));

  const { data: filesData } = useQuery({
    queryKey:['content-files', expId], queryFn:()=>getContentFiles(expId, { limit: 100 }), enabled:!!expId,
  });
  const expFiles = (filesData?.files || []).filter(Boolean);

  const { data: statusData } = useQuery({
    queryKey:['pub-status', statLine], queryFn:()=>getPublishStatus(statLine), enabled:!!statLine, refetchInterval:3000,
  });

  // ── Mutations ──
  const publishMut = useMutation({
    mutationFn: publishContent,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey:['content'] }); qc.invalidateQueries({ queryKey:['content-by-line'] });
      setPubModal(false); if(pubLineId) setStatLine(Number(pubLineId));
      toast(`✅ Published to ${d.tv_count} TV(s)!`);
    },
    onError: (e) => toast(e.message,'danger'),
  });
  const deleteContentMut = useMutation({
    mutationFn: deletePublishedContent,
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['content']}); qc.invalidateQueries({queryKey:['content-by-line']}); toast('Content permanently deleted'); },
    onError: (e)=>toast(e.message,'danger'),
  });
  const deleteHistMut = useMutation({
    mutationFn: (id)=>deletePublishHistory(id),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['publish-history']}); toast('History entry removed'); },
    onError: (e)=>toast(e.message,'danger'),
  });
  const republishMut = useMutation({
    mutationFn: republishContent,
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['content']}); qc.invalidateQueries({queryKey:['content-by-line']}); toast('✅ Content resumed!'); },
    onError: (e)=>toast(e.message,'danger'),
  });
  const unpublishMut = useMutation({
    mutationFn: unpublishContent,
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['content']}); qc.invalidateQueries({queryKey:['content-by-line']}); toast('Unpublished'); },
    onError: (e)=>toast(e.message,'danger'),
  });
  const durMut = useMutation({
    mutationFn: ({id,dur,docDur})=>setDuration(id,{duration:Number(dur)||10, doc_duration:docDur?Number(docDur):undefined}),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['content']}); setEditDurId(null); toast('Duration updated'); },
    onError: (e)=>toast(e.message,'danger'),
  });
  const delFileMut = useMutation({
    mutationFn: (fid)=>deleteContentFile(fid),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['content']}); qc.invalidateQueries({queryKey:['content-files',expId]}); setDelFileM(null); toast('File removed'); },
    onError: (e)=>toast(e.message,'danger'),
  });
  const toggleAsgMut = useMutation({ mutationFn:(id)=>toggleAssignment(id), onSuccess:()=>refetchAsg(), onError:(e)=>toast(e.message,'danger') });
  const delAsgMut    = useMutation({
    mutationFn:(id)=>deleteAssignment(id),
    onSuccess:()=>{ refetchAsg(); setDelAsgM(null); toast('Assignment removed'); },
    onError:(e)=>toast(e.message,'danger'),
  });

  const handleCreateAsg = async () => {
    if (!asgFileId) return toast('Select a file','warning');
    if (!asgDispId) return toast('Select a display','warning');
    setCreatingAsg(true);
    try {
      await createAssignment({ media_bucket_id:Number(asgFileId), display_id:Number(asgDispId), duration_seconds:Number(asgDur) });
      refetchAsg();
      setNewAsgModal(false); setAsgFolder(''); setAsgFileId(''); setAsgDispId(''); setAsgDur('10');
      toast('✅ Assignment created!');
    } catch(e) { toast(e.message,'danger'); }
    finally { setCreatingAsg(false); }
  };

  const openModal = () => {
    setPubTab('From Library'); setPubLineMode('one'); setPubLineId(''); setPubDispMode('all'); setPubSelDisps([]);
    setPubFolder(''); setSelFiles([]); setFileRepeats({});
    setUpFolder(''); setUpFiles([]);
    setDtDispNum(''); setDtFiles([]);
    setPubDur('10'); setPubDocDur('50');
    setAppendMode(false); setDtAppendMode(false);
    setPubModal(true);
  };

  const handlePublish = async () => {
    // ── Direct TV Upload ──
    if (pubTab === 'Direct TV Upload') {
      if (!dtDispNum) return toast('Select a target display','warning');
      if (!dtFiles.length) return toast('Add files to upload','warning');
      setUploading(true);
      try {
        const fd = new FormData();
        // Auto-detect the line from the chosen display
        const matchedDisplay = allDisplays.find(d => d.display_number === dtDispNum);
        const lineId = matchedDisplay?.production_line_id || lines[0]?.id || '1';
        fd.append('production_line_id', String(lineId));
        fd.append('display_number', dtDispNum);
        fd.append('duration', pubDur || '10');
        fd.append('doc_duration', pubDocDur || '50');
        // FIX: send as string 'true'/'false' — backend checks append_mode==='true'
        fd.append('append_mode', dtAppendMode ? 'true' : 'false');
        dtFiles.forEach(f=>fd.append('images',f));
        await directUpload(fd);
        qc.invalidateQueries({queryKey:['content']}); qc.invalidateQueries({queryKey:['content-by-line']});
        setPubModal(false); toast(`✅ Uploaded to ${dtDispNum}!`);
      } catch(e) { toast(e.message,'danger'); }
      finally { setUploading(false); }
      return;
    }

    // ── From Library / Upload New ──
    if (pubLineMode==='one' && !pubLineId) return toast('Select a production line','warning');
    if (pubTab==='From Library' && !pubFolder) return toast('Select a folder','warning');
    if (pubTab==='Upload New') {
      if (!upFolder.trim()) return toast('Enter a folder name','warning');
      if (!upFiles.length)  return toast('Add files to upload','warning');
    }

    const dur    = parseInt(pubDur,10)    || 10;
    const docDur = parseInt(pubDocDur,10) || 50;
    // Must match the backend's own normalization on upload (folderName.trim().replace(/\s+/g,'-'))
    // or a folder name with spaces gets stored hyphenated but published un-hyphenated, matching
    // zero rows and failing with "No files in selected folder."
    const upFolderNorm = upFolder.trim().replace(/\s+/g, '-');

    const payload = {
      folder_name:  pubTab==='From Library' ? pubFolder : upFolderNorm,
      duration:     dur,
      doc_duration: docDur,
      file_ids:     selFiles.length>0 ? selFiles : undefined,
      file_repeats: selFiles.length>0 && Object.values(fileRepeats).some(v=>v>1) ? fileRepeats : undefined,
      display_ids:  (pubDispMode==='specific' && pubSelDisps.length>0) ? pubSelDisps : undefined,
      // FIX: send append_mode as boolean — express-validator isBoolean() accepts true/false in JSON body
      append_mode:  appendMode === true,
    };

    if (pubLineMode==='all') {
      payload.all_lines = true;
    } else {
      // FIX: only add production_line_id when it's a valid positive integer
      const lineId = parseInt(pubLineId, 10);
      if (lineId > 0) payload.production_line_id = lineId;
    }

    if (pubTab==='Upload New') {
      setUploading(true);
      try {
        await uploadFilesApi(upFolderNorm, upFiles);
        qc.invalidateQueries({queryKey:['folders']});
        publishMut.mutate(payload);
      } catch(e) { toast(e.message,'danger'); }
      finally { setUploading(false); }
      return;
    }

    publishMut.mutate(payload);
  };

  const fileIcon = (name) => {
    const n = (name||'').toLowerCase();
    if (/\.(mp4|mov|avi|webm|mkv)$/.test(n)) return FILE_ICON.video;
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(n)) return FILE_ICON.image;
    if (/\.pdf$/.test(n)) return FILE_ICON.pdf;
    if (/\.(ppt|pptx)$/.test(n)) return FILE_ICON.presentation;
    return '📄';
  };

  const toggleFile = (id)=>setSelFiles(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleDisp = (id)=>setPubSelDisps(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  // publish_history.display_ids/file_ids come back from mysql2 as already-decoded
  // JSON columns (real arrays), not strings — JSON.parse(anArray) throws, so handle both.
  const parseIds = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  };

  const durationRow = (
    <div style={{ background:'var(--bg-main)', borderRadius:'var(--radius-md)', padding:14 }}>
      <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Duration Settings</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <Field label="Image (sec)"><Input type="number" min={1} value={pubDur} onChange={e=>setPubDur(e.target.value)}/></Field>
        <Field label="Doc per-page (sec)"><Input type="number" min={5} value={pubDocDur} onChange={e=>setPubDocDur(e.target.value)}/></Field>
      </div>
      {hasDocFiles && pubTab!=='Direct TV Upload' && (
        <div style={{ marginTop:8, background:'#FFF7ED', border:'1px solid var(--warning)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'var(--warning)', display:'flex', gap:6 }}>
          <AlertTriangle size={12} style={{ flexShrink:0, marginTop:1 }}/><span>Folder has PDF/PPT — doc duration ({pubDocDur}s/pg) applies</span>
        </div>
      )}
    </div>
  );

  const appendModeRow = (mode, setter) => (
    <div style={{background:'var(--bg-main)',borderRadius:'var(--radius-md)',padding:14}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Upload Mode</div>
      <div style={{display:'flex',gap:8}}>
        {[{v:false,icon:'🔄',label:'Replace All',desc:'Remove old content, insert new'},{v:true,icon:'➕',label:'Add to Existing',desc:'Keep old files, append new after them'}].map(opt=>(
          <div key={String(opt.v)} onClick={()=>setter(opt.v)} style={{flex:1,padding:'10px 12px',borderRadius:'var(--radius-sm)',cursor:'pointer',border:`1.5px solid ${mode===opt.v?'var(--primary)':'var(--border)'}`,background:mode===opt.v?'var(--primary-10)':'white',transition:'all .15s'}}>
            <div style={{fontWeight:700,fontSize:13}}>{opt.icon} {opt.label}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{opt.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div><h2>Publish Content</h2><p>Push media to TVs · manage assignments</p></div>
        <Button variant="primary" onClick={openModal}><Send size={16}/> Publish Content</Button>
      </div>

      {statusData && (
        <Card style={{ marginBottom:20, border:'2px solid var(--primary)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontWeight:700 }}>📡 Download Progress</div>
            <Button variant="ghost" size="sm" onClick={()=>setStatLine(null)}>✕</Button>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
              <span>{statusData.completed}/{statusData.total} TVs done</span>
              <span style={{ fontWeight:700, color:'var(--primary)' }}>{Math.round((statusData.completed/Math.max(statusData.total,1))*100)}%</span>
            </div>
            {/* Download progress is the inverse of a "usage" bar — more complete = better,
                so unlike ProgressBar's default (high% = danger), pass an explicit variant. */}
            <ProgressBar value={statusData.completed} max={statusData.total||1} size="md"
              variant={(() => {
                const donePct = (statusData.completed / Math.max(statusData.total, 1)) * 100;
                return donePct >= 80 ? 'success' : donePct >= 60 ? 'warning' : 'danger';
              })()}
            />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
            {(statusData.tvs||[]).map(tv=>(
              <div key={tv.display_id} style={{ padding:'6px 10px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:12, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:600 }}>{tv.display_number}</span>
                <span>{{completed:'✅',downloading:'⬇️',pending:'⏳'}[tv.status]} {tv.status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', borderRadius:'var(--radius-sm)', overflow:'hidden', border:'1px solid var(--border)' }}>
          {[{v:'cards',l:'TV Cards'},{v:'table',l:'Table'}].map(m=>(
            <button key={m.v} onClick={()=>setViewMode(m.v)} style={{ padding:'8px 14px', cursor:'pointer', border:'none', fontSize:13, fontWeight:600,
              background:viewMode===m.v?'var(--primary)':'white', color:viewMode===m.v?'white':'var(--text-body)' }}>
              {m.l}
            </button>
          ))}
        </div>
        {viewMode==='cards' && (
          <Select value={selLine} onChange={e=>setSelLine(e.target.value)} style={{ width:260 }}>
            <option value="">Select production line...</option>
            {lines.map(l=><option key={l.id} value={l.id}>{l.production_line_name}</option>)}
          </Select>
        )}
      </div>

      {viewMode==='cards' && (
        !selLine ? (
          <Card><div className="empty"><div style={{ fontSize:48,marginBottom:12 }}>📺</div><div className="empty__title">Select a line above</div></div></Card>
        ) : cardLoading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16 }}>
            {[...Array(4)].map((_,i)=><div key={i} className="skeleton" style={{ height:240,borderRadius:'var(--radius-lg)' }}/>)}
          </div>
        ) : tvCards.length===0 ? (
          <Card><div className="empty"><div className="empty__icon">📺</div><div className="empty__title">No displays in this line</div></div></Card>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16 }}>
            {tvCards.map(tv=><TvCard key={tv.id} tv={tv}/>)}
          </div>
        )
      )}

      {viewMode==='table' && (
        <Card title="Published Content" style={{ marginBottom:20 }}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Display</th><th>Line</th><th>Files</th><th>Duration</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                {content.map(c=>(
                  <React.Fragment key={c.id}>
                    <tr>
                      <td><div className="table__name">{c.display_name||c.display_number}</div><code style={{fontSize:11,color:'var(--text-muted)'}}>{c.display_number}</code></td>
                      <td style={{fontSize:13}}>{c.production_line_name}</td>
                      <td><Badge variant="primary">{c.file_count} files</Badge></td>
                      <td>
                        {editDurId===c.id ? (
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <Input type="number" value={newDur} onChange={e=>setNewDur(e.target.value)} style={{width:70,height:30,fontSize:13}}/>
                            <Button variant="primary" size="sm" loading={durMut.isPending} onClick={()=>durMut.mutate({id:c.id,dur:Number(newDur)})}>✓</Button>
                            <Button variant="ghost" size="sm" onClick={()=>setEditDurId(null)}>✕</Button>
                          </div>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:13}}>{c.duration}s</span>
                            <button onClick={()=>{setEditDurId(c.id);setNewDur(c.duration);}} style={{padding:'2px 5px',border:'1px solid var(--border)',borderRadius:5,cursor:'pointer',background:'white',fontSize:10}}><Clock size={10}/></button>
                          </div>
                        )}
                      </td>
                      <td><Badge variant={c.is_published?'success':'warning'}>{c.is_published?'Published':'⏸ Paused'}</Badge></td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{fmt.ago(c.updated_at)}</td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          {c.is_published ? (
                            <Button variant="warning" size="sm" title="Pause" loading={unpublishMut.isPending} onClick={()=>unpublishMut.mutate({production_line_id:Number(c.production_line_id),display_id:Number(c.display_id)})}>⏸</Button>
                          ) : (
                            <Button variant="success" size="sm" title="Resume" loading={republishMut.isPending} onClick={()=>republishMut.mutate({production_line_id:Number(c.production_line_id),display_id:Number(c.display_id)})}>▶</Button>
                          )}
                          <Button variant="danger" size="sm" title="Permanently delete" loading={deleteContentMut.isPending}
                            onClick={()=>{if(confirm('Permanently delete ALL content for this display?')) deleteContentMut.mutate({production_line_id:Number(c.production_line_id),display_id:Number(c.display_id)});}}>🗑</Button>
                          <Button variant="ghost" size="sm" onClick={()=>setExpId(expId===c.id?null:c.id)}>{expId===c.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</Button>
                        </div>
                      </td>
                    </tr>
                    {expId===c.id && (
                      <tr key={`exp-${c.id}`}><td colSpan={7} style={{padding:'0 16px 12px',background:'var(--bg-main)'}}>
                        <table className="table" style={{margin:0,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden'}}>
                          <thead><tr><th>#</th><th>Preview</th><th>File</th><th>Type</th><th>Duration</th><th>Status</th><th></th></tr></thead>
                          <tbody>
                            {expFiles.map((f,i)=>(
                              <tr key={f.id}>
                                <td style={{fontSize:12,color:'var(--text-muted)'}}>{f.sequence_order||i+1}</td>
                                <td><div onClick={()=>setPreviewFile(f)} style={{cursor:'pointer'}}>{f.file_type==='image'&&thumbUrl(f.file_path)?<div style={{width:32,height:32,borderRadius:4,overflow:'hidden',border:'1px solid var(--border)'}}><img src={thumbUrl(f.file_path)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'}}/></div>:<span style={{fontSize:16}}>{FILE_ICON[f.file_type]||'📄'}</span>}</div></td>
                                <td><div className="table__name" style={{fontSize:12}}>{f.file_name}</div></td>
                                <td><Badge variant="primary">{f.file_type}</Badge></td>
                                <td style={{fontSize:12,color:'var(--text-muted)'}}>
                                  {isDocType(f.file_name) ? (
                                    editDocDurId===f.id ? (
                                      <div style={{display:'flex',gap:4,alignItems:'center'}}>
                                        <input type="number" min={5} value={newDocDur} onChange={e=>setNewDocDur(e.target.value)} style={{width:55,height:28,borderRadius:4,border:'1px solid var(--border)',padding:'0 6px',fontSize:12}}/>
                                        <span style={{fontSize:11}}>s/pg</span>
                                        <button style={{padding:'2px 6px',background:'var(--primary)',color:'white',border:'none',borderRadius:4,cursor:'pointer',fontSize:11}} onClick={()=>{durMut.mutate({id:expId,dur:f.duration||10,docDur:Number(newDocDur)});setEditDocDurId(null);}}>✓</button>
                                        <button style={{padding:'2px 5px',background:'var(--border)',border:'none',borderRadius:4,cursor:'pointer',fontSize:11}} onClick={()=>setEditDocDurId(null)}>✕</button>
                                      </div>
                                    ) : (
                                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                                        <span>{f.doc_duration_seconds||50}s/pg</span>
                                        <button title="Edit doc duration" onClick={()=>{setEditDocDurId(f.id);setNewDocDur(String(f.doc_duration_seconds||50));}} style={{padding:'2px 5px',border:'1px solid var(--border)',borderRadius:4,cursor:'pointer',background:'white',fontSize:10}}>✏️</button>
                                      </div>
                                    )
                                  ) : (
                                    <span>{f.duration||10}s</span>
                                  )}
                                </td>
                                <td>
                                  {errFiles.has((f.file_name||'').toLowerCase())
                                    ? <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'#FEE2E2',color:'#DC2626',borderRadius:99,padding:'2px 8px',fontSize:11,fontWeight:700}}>⚠️ Error</span>
                                    : <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'#D1FAE5',color:'#065F46',borderRadius:99,padding:'2px 8px',fontSize:11,fontWeight:700}}>✅ OK</span>
                                  }
                                </td>
                                <td><Button variant="ghost" size="sm" onClick={()=>setDelFileM(f)}><Trash2 size={12} color="var(--danger)"/></Button></td>
                              </tr>
                            ))}
                            {!expFiles.length && <tr key="ef-none"><td colSpan={7}><div className="empty" style={{padding:10}}><div className="empty__title">No files</div></div></td></tr>}
                          </tbody>
                        </table>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
                {!content.length && <tr key="ct-none"><td colSpan={7}><div className="empty"><div className="empty__icon">📺</div><div className="empty__title">No published content</div></div></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={contentPage} totalPages={contentTotalPages} total={contentTotal} pageSize={15} onPage={setContentPage} />
        </Card>
      )}

      {/* ── PUBLISH HISTORY ── */}
      <Card title="Publish History" subtitle="Re-publish previous content with one click" style={{ marginTop:20 }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Folder</th><th>Line</th><th>TVs</th><th>Duration</th><th>Doc/pg</th><th>Published</th><th></th></tr></thead>
            <tbody>
              {publishHistory.map(h=>{
                const histDisplayIds = parseIds(h.display_ids);
                return (
                <React.Fragment key={h.id}>
                <tr>
                  <td><div className="table__name">{h.folder_name}</div></td>
                  <td style={{fontSize:13}}>{h.production_line_name||'All lines'}</td>
                  <td>
                    <button onClick={()=>setExpHistId(expHistId===h.id?null:h.id)}
                      style={{display:'inline-flex',alignItems:'center',gap:4,border:'none',background:'none',cursor:'pointer',padding:0}}
                      title="Show which TVs">
                      <Badge variant="primary">{h.tv_count} TVs</Badge>
                      {expHistId===h.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </button>
                  </td>
                  <td style={{fontSize:12}}>{h.duration}s</td>
                  <td style={{fontSize:12}}>{h.doc_duration}s/pg</td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{fmt.ago(h.created_at)}</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <Button variant="secondary" size="sm" loading={publishMut.isPending}
                        onClick={()=>{
                          const payload={folder_name:h.folder_name,duration:h.duration,doc_duration:h.doc_duration,append_mode:false};
                          if(h.all_lines) payload.all_lines=true; else payload.production_line_id=h.production_line_id;
                          if(histDisplayIds.length) payload.display_ids=histDisplayIds;
                          const histFileIds = parseIds(h.file_ids);
                          if(histFileIds.length) payload.file_ids=histFileIds;
                          publishMut.mutate(payload);
                        }}>🔄 Re-publish</Button>
                      <Button variant="ghost" size="sm" loading={deleteHistMut.isPending} onClick={()=>deleteHistMut.mutate(h.id)}>🗑</Button>
                    </div>
                  </td>
                </tr>
                {expHistId===h.id && (
                  <tr><td colSpan={7} style={{padding:'0 16px 12px',background:'var(--bg-main)'}}>
                    <div style={{fontSize:12,color:'var(--text-muted)',padding:'10px 4px'}}>
                      {histDisplayIds.length ? (
                        <>
                          <strong style={{color:'var(--text-heading)'}}>TVs in this publish: </strong>
                          {histDisplayIds.map(id => {
                            const d = allDisplays.find(x => String(x.id)===String(id));
                            return d ? (d.display_name || d.display_number) : `#${id}`;
                          }).join(', ')}
                        </>
                      ) : h.all_lines ? (
                        <>All displays across all production lines</>
                      ) : (
                        <>All displays in <strong style={{color:'var(--text-heading)'}}>{h.production_line_name || 'this line'}</strong></>
                      )}
                    </div>
                  </td></tr>
                )}
                </React.Fragment>
              );})}
              {!publishHistory.length && <tr key="ph-none"><td colSpan={7}><div className="empty"><div className="empty__title">No publish history yet</div></div></td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={histPage} totalPages={histTotalPages} total={histTotal} pageSize={10} onPage={setHistPage} />
      </Card>

      {/* ── PUBLISH MODAL ── */}
      <Modal open={pubModal} onClose={()=>setPubModal(false)} title="Publish Content to TVs"
        footer={<><Button variant="secondary" onClick={()=>setPubModal(false)}>Cancel</Button><Button variant="primary" loading={publishMut.isPending||uploading} onClick={handlePublish}>{pubTab==='Direct TV Upload'?<><Tv size={14}/> Upload to TV</>:<><Send size={14}/> Publish</>}</Button></>}>
        <div className="form-grid">

          {/* Tab bar — 2 tabs only */}
          <div style={{display:'flex',borderRadius:'var(--radius-sm)',overflow:'hidden',border:'1px solid var(--border)',width:'fit-content'}}>
            {PUB_TABS.map(t=>(<button key={t} onClick={()=>{setPubTab(t);setSelFiles([]);setUpFiles([]);setDtFiles([]);}} style={{padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',border:'none',background:pubTab===t?'var(--primary)':'white',color:pubTab===t?'white':'var(--text-body)'}}>{t}</button>))}
          </div>

          {pubTab==='Direct TV Upload' ? (
            /* ── DIRECT TV UPLOAD ── */
            <>
              {/* Only display selector — no production line dropdown */}
              <div style={{background:'var(--bg-main)',borderRadius:'var(--radius-md)',padding:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Target Display</div>
                <Field label="Select Display *">
                  <Select value={dtDispNum} onChange={e=>setDtDispNum(e.target.value)}>
                    <option value="">Select display...</option>
                    {allDisplays.map(d=>(
                      <option key={d.id} value={d.display_number}>{d.display_name} ({d.display_number})</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {durationRow}
              {appendModeRow(dtAppendMode, setDtAppendMode)}
              <div {...getDtRootProps()} style={{border:`2px dashed ${isDtDrag?'var(--primary)':'var(--border)'}`,borderRadius:'var(--radius-md)',padding:24,textAlign:'center',cursor:'pointer',background:isDtDrag?'var(--primary-10)':'var(--bg-main)'}}>
                <input {...getDtInputProps()}/>
                <div style={{fontSize:32,marginBottom:8}}>📺</div>
                <p style={{fontWeight:600,fontSize:14}}>{isDtDrag?'Drop files...':'Drag files for this TV'}</p>
                <p style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Multiple files supported</p>
              </div>
              {dtFiles.length>0 && (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {dtFiles.map((f,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 12px',background:'var(--bg-main)',borderRadius:'var(--radius-sm)',fontSize:13}}>
                      <span>{fileIcon(f.name)}</span>
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}}>{f.name}</span>
                      <span style={{fontSize:11,color:'var(--text-muted)',flexShrink:0}}>{(f.size/1024/1024).toFixed(1)}MB</span>
                      <button onClick={()=>setDtFiles(p=>p.filter((_,j)=>j!==i))} style={{color:'var(--danger)',background:'none',border:'none',cursor:'pointer',fontSize:16,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* ── FROM LIBRARY ── */
            <>
              {/* Step 1 — Production Line */}
              <div style={{background:'var(--bg-main)',borderRadius:'var(--radius-md)',padding:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Step 1 — Production Line</div>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  {[{v:'one',l:'One Line'},{v:'all',l:'All Lines'}].map(o=>(
                    <button key={o.v} onClick={()=>{setPubLineMode(o.v);setPubLineId('');setPubSelDisps([]);}}
                      style={{padding:'6px 14px',borderRadius:99,fontSize:13,fontWeight:600,cursor:'pointer',
                        border:`1.5px solid ${pubLineMode===o.v?'var(--primary)':'var(--border)'}`,
                        background:pubLineMode===o.v?'var(--primary)':'white',
                        color:pubLineMode===o.v?'white':'var(--text-body)'}}>
                      {o.l}
                    </button>
                  ))}
                </div>
                {pubLineMode==='one' && (
                  <Select value={pubLineId} onChange={e=>{setPubLineId(e.target.value);setPubSelDisps([]);}}>
                    <option value="">Choose a line...</option>
                    {lines.map(l=><option key={l.id} value={l.id}>{l.production_line_name}</option>)}
                  </Select>
                )}
                {pubLineMode==='all' && <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>Will publish to ALL active production lines</div>}
              </div>

              {/* Step 2 — Displays */}
              {(pubLineMode==='all'||pubLineId) && (
                <div style={{background:'var(--bg-main)',borderRadius:'var(--radius-md)',padding:14}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Step 2 — Displays</div>
                  <div style={{display:'flex',gap:8,marginBottom:10}}>
                    {[{v:'all',l:'All Displays — Same Content'},{v:'specific',l:'Specific Displays -specific Content' }].map(o=>(
                      <button key={o.v} onClick={()=>{setPubDispMode(o.v);setPubSelDisps(o.v==='specific'?displaysInLine.map(d=>d.id):[]);}}
                        style={{padding:'6px 14px',borderRadius:99,fontSize:13,fontWeight:600,cursor:'pointer',
                          border:`1.5px solid ${pubDispMode===o.v?'var(--primary)':'var(--border)'}`,
                          background:pubDispMode===o.v?'var(--primary)':'white',
                          color:pubDispMode===o.v?'white':'var(--text-body)'}}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {pubDispMode==='specific' && (
                    <>
                      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                        <button onClick={()=>setPubSelDisps(pubSelDisps.length===displaysInLine.length?[]:displaysInLine.map(d=>d.id))}
                          style={{fontSize:12,color:'var(--primary)',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>
                          {pubSelDisps.length===displaysInLine.length?'Deselect all':'Select all'}
                        </button>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:150,overflowY:'auto'}}>
                        {displaysInLine.map(d=>{const sel=pubSelDisps.includes(d.id);return(
                          <div key={d.id} onClick={()=>toggleDisp(d.id)}
                            style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:'var(--radius-sm)',cursor:'pointer',
                              border:`1.5px solid ${sel?'var(--primary)':'var(--border)'}`,background:sel?'var(--primary-10)':'white'}}>
                            <div style={{width:8,height:8,borderRadius:'50%',background:d.status==='ONLINE'?'var(--success)':'var(--danger)',flexShrink:0}}/>
                            <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${sel?'var(--primary)':'var(--border)'}`,background:sel?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {sel&&<span style={{color:'white',fontSize:10,fontWeight:800}}>✓</span>}
                            </div>
                            <Monitor size={12} color="var(--text-muted)"/>
                            <span style={{fontSize:12,fontWeight:600,flex:1}}>{d.display_name}</span>
                            <code style={{fontSize:11,color:'var(--text-muted)'}}>{d.display_number}</code>
                          </div>
                        );})}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 3 — Content */}
              <div style={{background:'var(--bg-main)',borderRadius:'var(--radius-md)',padding:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Step 3 — Content</div>
                {pubTab==='From Library' ? (
                  <>
                    <Field label="Folder *">
                      <Select value={pubFolder} onChange={e=>{setPubFolder(e.target.value);setSelFiles([]);}}>
                        <option value="">Select folder...</option>
                        {folders.map(f=><option key={f.folder_name} value={f.folder_name}>{f.folder_name} ({f.file_count} files)</option>)}
                      </Select>
                    </Field>
                    {pubFolder && folderFiles.length>0 && (
                      <div style={{marginTop:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                          <label style={{fontSize:12,fontWeight:600}}>Files <span style={{color:'var(--text-muted)',fontWeight:400}}>(empty = all)</span></label>
                          <button onClick={()=>setSelFiles(selFiles.length===folderFiles.length?[]:folderFiles.map(f=>f.id))}
                            style={{fontSize:12,color:'var(--primary)',fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>
                            {selFiles.length===folderFiles.length?'Deselect all':'Select all'}
                          </button>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:160,overflowY:'auto'}}>
                          {folderFiles.map(f=>{const sel=selFiles.includes(f.id);return(
                            <div key={f.id} onClick={()=>toggleFile(f.id)}
                              style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:'var(--radius-sm)',cursor:'pointer',
                                border:`1.5px solid ${sel?'var(--primary)':'var(--border)'}`,background:sel?'var(--primary-10)':'white'}}>
                              <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${sel?'var(--primary)':'var(--border)'}`,background:sel?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                {sel&&<span style={{color:'white',fontSize:9,fontWeight:800}}>✓</span>}
                              </div>
                              <span style={{fontSize:15}}>{FILE_ICON[f.file_type]||'📄'}</span>
                              <span style={{fontSize:12,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.file_name}</span>
                              {isDocType(f.file_name)&&<Badge variant="warning" style={{fontSize:10}}>DOC</Badge>}
                              {sel&&(
                                <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:3,flexShrink:0}}>
                                  <span style={{fontSize:10,color:'var(--text-muted)'}}>×</span>
                                  <button onClick={()=>setFileRepeats(r=>({...r,[f.id]:Math.max(1,(r[f.id]||1)-1)}))} style={{width:20,height:20,borderRadius:4,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                                  <span style={{minWidth:18,textAlign:'center',fontSize:13,fontWeight:800,color:'var(--primary)'}}>{fileRepeats[f.id]||1}</span>
                                  <button onClick={()=>setFileRepeats(r=>({...r,[f.id]:Math.min(10,(r[f.id]||1)+1)}))} style={{width:20,height:20,borderRadius:4,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                                </div>
                              )}
                            </div>
                          );})}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Field label="Save to Folder">
                      <Input placeholder="e.g. promo-july" value={upFolder} onChange={e=>setUpFolder(e.target.value)} list="existing-folder-names"/>
                    </Field>
                    <datalist id="existing-folder-names">
                      {folders.map(f=><option key={f.folder_name} value={f.folder_name}/>)}
                    </datalist>
                    {upFolderMatch && (
                      <div style={{ marginTop:8, background:'#FFF7ED', border:'1px solid var(--warning)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12, color:'var(--warning)', display:'flex', gap:6 }}>
                     
                        <span>Folder already exists ({upFolderMatch.file_count} files)-upload will-add same folder and play all files.</span>
                      </div>
                    )}
                    <div {...getUpRootProps()} style={{border:`2px dashed ${isUpDrag?'var(--primary)':'var(--border)'}`,borderRadius:'var(--radius-md)',padding:20,textAlign:'center',cursor:'pointer',background:isUpDrag?'var(--primary-10)':'white',marginTop:8}}>
                      <input {...getUpInputProps()}/>
                      <div style={{fontSize:28,marginBottom:6}}>📥</div>
                      <p style={{fontWeight:600,fontSize:13}}>{isUpDrag?'Drop files...':'Drag & drop or click'}</p>
                    </div>
                    {upFiles.length>0 && (
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
                        {upFiles.map((f,i)=>(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 10px',background:'white',borderRadius:'var(--radius-sm)',fontSize:12,border:'1px solid var(--border)'}}>
                            <span>{fileIcon(f.name)}</span>
                            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                            <span style={{fontSize:11,color:'var(--text-muted)',flexShrink:0}}>{(f.size/1024/1024).toFixed(1)}MB</span>
                            <button onClick={()=>setUpFiles(p=>p.filter((_,j)=>j!==i))} style={{color:'var(--danger)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {durationRow}
              {appendModeRow(appendMode, setAppendMode)}
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!delFileM} onClose={()=>setDelFileM(null)} title="Remove File" message={`Remove "${delFileM?.file_name}"?`} loading={delFileMut.isPending} onConfirm={()=>delFileMut.mutate(delFileM.id)}/>
      <ConfirmModal open={!!delAsgM}  onClose={()=>setDelAsgM(null)}  title="Delete Assignment" message={`Remove assignment for "${delAsgM?.file_name}"?`} loading={delAsgMut.isPending} onConfirm={()=>delAsgMut.mutate(delAsgM.id)}/>
      <FilePreview file={previewFile} open={!!previewFile} onClose={()=>setPreviewFile(null)}/>
    </div>
  );
}