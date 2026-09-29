'use client';
// src/components/ui/FilePreview.js
// Shared preview modal for ALL file types: image, video, PDF, docs
// Used across: Published Content, Media Bucket, Assignments
import { useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

// FIX: Never point <img>/<video> straight at the backend. Helmet sets
// Cross-Origin-Resource-Policy: same-origin, so localhost:3000 loading
// localhost:5004 is blocked with ERR_BLOCKED_BY_RESPONSE.NotSameOrigin.
// Always go through the same-origin /api/logo proxy instead.
const getFullUrl = (filePath) => {
  if (!filePath) return '';
  const clean = filePath.replace(/^\/+/, '');
  return `/api/logo?path=/${clean}`;
};

const getExt = (name) => (name || '').split('.').pop()?.toLowerCase() || '';

export default function FilePreview({ file, open, onClose }) {
  const [imgError, setImgError] = useState(false);

  if (!open || !file) return null;

  const ext  = getExt(file.file_name);
  const url  = getFullUrl(file.file_path);
  const type = file.file_type ||
    (['mp4','mov','avi','webm','mkv'].includes(ext) ? 'video'
    : ['jpg','jpeg','png','gif','webp','bmp'].includes(ext) ? 'image'
    : ext === 'pdf' ? 'pdf'
    : ['ppt','pptx'].includes(ext) ? 'presentation'
    : 'other');

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'90vw', maxWidth:900, maxHeight:'90vh',
        background:'#111', borderRadius:12, overflow:'hidden',
        display:'flex', flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.1)',
        }}>
          <div style={{ flex:1, minWidth:0, marginRight:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {file.file_name}
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginTop:2 }}>
              {type.toUpperCase()} · {ext}
              {file.duration ? ` · ${file.duration}s` : ''}
              {file.doc_duration_seconds ? ` · ${file.doc_duration_seconds}s/page` : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <a href={url} target="_blank" rel="noopener noreferrer"
              style={{ padding:'6px 12px', borderRadius:6, background:'rgba(255,255,255,.15)', color:'#fff', textDecoration:'none', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              <ExternalLink size={12}/> Open
            </a>
            <a href={url} download={file.file_name}
              style={{ padding:'6px 12px', borderRadius:6, background:'rgba(255,255,255,.15)', color:'#fff', textDecoration:'none', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              <Download size={12}/> Download
            </a>
            <button onClick={onClose}
              style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,.1)', color:'#fff', border:'none', cursor:'pointer' }}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex:1, display:'flex', alignItems:'center', justifyContent:'center',
          padding:16, overflow:'auto', minHeight:300,
        }}>
          {/* IMAGE */}
          {type === 'image' && !imgError && (
            <img src={url} alt={file.file_name}
              style={{ maxWidth:'100%', maxHeight:'70vh', objectFit:'contain', borderRadius:6 }}
              onError={() => setImgError(true)}/>
          )}

          {/* VIDEO */}
          {type === 'video' && (
            <video controls autoPlay style={{ maxWidth:'100%', maxHeight:'70vh', borderRadius:6 }}>
              <source src={url} type={`video/${ext === 'mov' ? 'quicktime' : ext}`}/>
              Your browser does not support video playback.
            </video>
          )}

          {/* PDF */}
          {type === 'pdf' && (
            <iframe src={url} title={file.file_name}
              style={{ width:'100%', height:'70vh', border:'none', borderRadius:6, background:'white' }}/>
          )}

          {/* UNSUPPORTED or image error */}
          {(type === 'presentation' || type === 'document' || type === 'spreadsheet' || type === 'other' || (type === 'image' && imgError)) && (
            <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:64, marginBottom:16 }}>
                {type==='presentation'?'📊':type==='document'?'📝':type==='spreadsheet'?'📗':'📄'}
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>{file.file_name}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginBottom:20 }}>
                {type === 'image' && imgError ? 'Image could not be loaded' : `${ext.toUpperCase()} files can't be previewed in browser`}
              </div>
              <a href={url} download={file.file_name}
                style={{ padding:'10px 24px', borderRadius:8, background:'var(--primary)', color:'#fff', textDecoration:'none', fontSize:14, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
                <Download size={14}/> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}