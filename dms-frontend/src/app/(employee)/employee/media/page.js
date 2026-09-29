'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery } from '@tanstack/react-query';
import { uploadFiles, directUpload, getLines, getDisplays } from '../../../../lib/api';
import { useToast } from '../../../../components/ui/Toast';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { Field, Input, Select } from '../../../../components/ui/Input';
import { Upload, Tv, X } from 'lucide-react';

export default function EmployeeMedia() {
  const toast = useToast();

const { data: lineData }    = useQuery({ queryKey:['lines-all',    'EMPLOYEE'], queryFn: () => getLines({ limit: 500 }) });
const { data: displayData } = useQuery({ queryKey:['displays-all', 'EMPLOYEE'], queryFn: () => getDisplays({ limit: 500 }) });
  const lines    = lineData?.lines       || [];
  const displays = displayData?.displays || [];

  const [folderName,  setFolderName]  = useState('');
  const [bucketFiles, setBucketFiles] = useState([]);
  const [uploading,   setUploading]   = useState(false);

  const [lineId,      setLineId]      = useState('');
  const [tvNumber,    setTvNumber]    = useState('');
  const [duration,    setDuration]    = useState('10');
  const [tvFiles,     setTvFiles]     = useState([]);
  const [tvUploading, setTvUploading] = useState(false);

  const onBucketDrop = useCallback((accepted) => {
    setBucketFiles(prev => [...prev, ...accepted]);
  }, []);

  const onTvDrop = useCallback((accepted) => {
    setTvFiles(prev => [...prev, ...accepted]);
  }, []);

  const {
    getRootProps: getBucketRootProps,
    getInputProps: getBucketInputProps,
    isDragActive: isBucketDragActive,
  } = useDropzone({ onDrop: onBucketDrop });

  const {
    getRootProps: getTvRootProps,
    getInputProps: getTvInputProps,
    isDragActive: isTvDragActive,
  } = useDropzone({ onDrop: onTvDrop });

  const handleBucketUpload = async () => {
    if (!folderName.trim()) return toast('Folder name is required', 'warning');
    if (!bucketFiles.length) return toast('Select at least one file', 'warning');
    setUploading(true);
    try {
      await uploadFiles(folderName.trim(), bucketFiles);
      setBucketFiles([]);
      setFolderName('');
      toast(`Uploaded ${bucketFiles.length} file(s) to "${folderName}"`);
    } catch (e) {
      toast(e.message, 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleTvUpload = async () => {
    if (!lineId)         return toast('Select a production line', 'warning');
    if (!tvNumber)       return toast('Select a target display', 'warning');
    if (!tvFiles.length) return toast('Select at least one file', 'warning');
    setTvUploading(true);
    try {
      const form = new FormData();
      form.append('production_line_id', lineId);
      form.append('display_number', tvNumber);
      form.append('duration', duration);
      tvFiles.forEach(f => form.append('images', f));
      await directUpload(form);
      setTvFiles([]);
      setLineId('');
      setTvNumber('');
      toast('Files uploaded directly to TV!');
    } catch (e) {
      toast(e.message, 'danger');
    } finally {
      setTvUploading(false);
    }
  };

  const dropZoneStyle = (active) => ({
    border: `2px dashed ${active ? 'var(--primary)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    padding: 32,
    textAlign: 'center',
    cursor: 'pointer',
    background: active ? 'var(--primary-10)' : 'var(--bg-main)',
    transition: 'all .18s',
    userSelect: 'none',
  });

  const FileList = ({ files, setList }) =>
    files.length > 0 ? (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {files.map((f, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:13 }}>
            <span>📄</span>
            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
            <span style={{ color:'var(--text-muted)', flexShrink:0, fontSize:12 }}>{(f.size/1024/1024).toFixed(1)} MB</span>
            <button onClick={() => setList(p => p.filter((_, j) => j !== i))}
              style={{ color:'var(--danger)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Upload Media</h2>
          <p>Upload to media library or directly to a TV display</p>
        </div>
      </div>

      <div className="two-col">

        {/* Bucket Upload */}
        <Card title="Upload to Media Library" subtitle="Files go to your media bucket for use in publish flows">
          <div className="form-grid">
            <Field label="Folder Name *" hint="Files will be grouped under this folder">
              <Input
                placeholder="e.g. spring-promo-2026"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
              />
            </Field>

            <div {...getBucketRootProps()} style={dropZoneStyle(isBucketDragActive)}>
              <input {...getBucketInputProps()} />
              <div style={{ fontSize:36, marginBottom:8 }}>📥</div>
              <p style={{ fontWeight:600, color:'var(--text-heading)', fontSize:14 }}>
                {isBucketDragActive ? 'Drop files here…' : 'Drag files here or click to browse'}
              </p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
                Images, videos, PDFs, presentations
              </p>
            </div>

            <FileList files={bucketFiles} setList={setBucketFiles} />

            <Button variant="primary" loading={uploading} onClick={handleBucketUpload} style={{ width:'100%' }}>
              <Upload size={16} />
              Upload to Library {bucketFiles.length ? `(${bucketFiles.length})` : ''}
            </Button>
          </div>
        </Card>

        {/* Direct TV Upload */}
        <Card title="Direct TV Upload" subtitle="Upload files directly to a specific display — bypasses media library">
          <div className="form-grid">
            <Field label="Production Line *">
              <Select value={lineId} onChange={e => setLineId(e.target.value)}>
                <option value="">Select line...</option>
                {lines.map(l => (
                  <option key={l.id} value={l.id}>{l.production_line_name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Target Display *">
              <Select value={tvNumber} onChange={e => setTvNumber(e.target.value)}>
                <option value="">Select display...</option>
                {displays.map(d => (
                  <option key={d.id} value={d.display_number}>
                    {d.display_name} ({d.display_number})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Duration (seconds)" hint="For images/PDFs only">
              <Input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} />
            </Field>

            <div {...getTvRootProps()} style={dropZoneStyle(isTvDragActive)}>
              <input {...getTvInputProps()} />
              <div style={{ fontSize:36, marginBottom:8 }}>📺</div>
              <p style={{ fontWeight:600, color:'var(--text-heading)', fontSize:14 }}>
                {isTvDragActive ? 'Drop files here…' : 'Drag files for this TV'}
              </p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
                Images, videos, PDFs, presentations
              </p>
            </div>

            <FileList files={tvFiles} setList={setTvFiles} />

            <Button variant="secondary" loading={tvUploading} onClick={handleTvUpload} style={{ width:'100%' }}>
              <Tv size={16} />
              Upload to TV {tvFiles.length ? `(${tvFiles.length})` : ''}
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
}