'use client';
// src/app/(admin)/admin/displays/[id]/page.js
// FIXES:
// - Published content section with unpublish + per-file delete
// - Volume slider MQTT fires on release (onPointerUp) not every drag tick
// - Per-display media storage shown
// - Error logs shown
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDisplay, setVolume, resetDisplayPassword,
  getAssignmentsByDisplay, getLineByDisplay, getDisplayErrors,
  getContentByLine, deleteContentFile, unpublishContent, republishContent, deletePublishedContent,
} from '../../../../../lib/api';
import { fmt, thumbUrl, isDocType } from '../../../../../lib/utils';
import Card from '../../../../../components/ui/Card';
import Badge from '../../../../../components/ui/Badge';
import Button from '../../../../../components/ui/Button';
import Modal from '../../../../../components/ui/Modal';
import ConfirmModal from '../../../../../components/ui/ConfirmModal';
import { Field, Input } from '../../../../../components/ui/Input';
import { useToast } from '../../../../../components/ui/Toast';
import { ArrowLeft, Volume2, Key, RefreshCw, GitBranch, User, HardDrive, Trash2, StopCircle } from 'lucide-react';
import Link from 'next/link';

const FILE_ICON = { video:'🎬', image:'🖼️', pdf:'📄', presentation:'📊' };

export default function DisplayDetailPage() {
  const { id } = useParams();
  const toast  = useToast();
  const qc     = useQueryClient();

  const [pwModal,   setPwModal]  = useState(false);
  const [newPw,     setNewPw]    = useState('');
  const [localVol,  setLocalVol] = useState(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState(null);

  const { data, refetch } = useQuery({
    queryKey: ['display', id],
    queryFn:  () => getDisplay(id),
    refetchInterval: 10_000,
  });
  const { data: asgData }  = useQuery({ queryKey:['assignments-display', id], queryFn: () => getAssignmentsByDisplay(id, { limit: 100 }) });
  const { data: lineData } = useQuery({ queryKey:['display-line', id],        queryFn: () => getLineByDisplay(id) });
  const { data: errData }  = useQuery({ queryKey:['display-errors', id],      queryFn: () => getDisplayErrors(id, { limit: 50 }), refetchInterval: 30_000 });

  const d      = data?.display;
  const line   = lineData?.line;
  const errors = errData?.errors || [];

  // Load published content for this display via its line
  const { data: lineContentData, refetch: refetchContent } = useQuery({
    queryKey: ['display-content', id, line?.id],
    queryFn:  () => getContentByLine(line.id, { limit: 100 }),
    enabled:  !!line?.id,
  });
  // Find this specific TV's content
  const tvContent = lineContentData?.tvs?.find(t => String(t.id) === String(id));
  const allFiles = tvContent?.files || [];
  const isPublished = allFiles.length > 0 && allFiles[0]?.is_published !== 0;
  const publishedFiles = allFiles;

  useEffect(() => {
    if (d?.volume_level !== undefined && localVol === null) {
      setLocalVol(d.volume_level);
    }
  }, [d?.volume_level]);

  const displayVol = localVol ?? d?.volume_level ?? 50;

  const volMut = useMutation({
    mutationFn: (vol) => setVolume(id, { volume_level: vol }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:['display', id] }); toast(`Volume set to ${displayVol}%`); },
    onError: (e) => toast(e.message, 'danger'),
  });

  const pwMut = useMutation({
    mutationFn: (pw) => resetDisplayPassword(id, { new_password: pw }),
    onSuccess:  () => { setPwModal(false); setNewPw(''); toast('Password updated'); },
    onError:    (e) => toast(e.message, 'danger'),
  });

  const delFileMut = useMutation({
    mutationFn: (fid) => deleteContentFile(fid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['display-content', id, line?.id] });
      refetchContent();
      setDeleteFileTarget(null);
      toast('File removed from playlist');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const unpublishMut = useMutation({
    mutationFn: () => unpublishContent({ production_line_id: line?.id, display_id: Number(id) }),
    onSuccess: () => { refetchContent(); toast('Content paused'); },
    onError: (e) => toast(e.message, 'danger'),
  });

  const republishMut = useMutation({
    mutationFn: () => republishContent({ production_line_id: line?.id, display_id: Number(id) }),
    onSuccess: () => { refetchContent(); toast('Content resumed'); },
    onError: (e) => toast(e.message, 'danger'),
  });

  const deleteContentMut = useMutation({
    mutationFn: () => deletePublishedContent({ production_line_id: line?.id, display_id: Number(id) }),
    onSuccess: () => { refetchContent(); toast('Content deleted'); },
    onError: (e) => toast(e.message, 'danger'),
  });

  if (!d) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div className="spinner spinner--lg" style={{ margin:'0 auto' }}/>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/admin/displays"><Button variant="ghost" size="sm"><ArrowLeft size={16}/></Button></Link>
          <div>
            <h2>{d.display_name}</h2>
            <code style={{ fontSize:13, color:'var(--text-muted)' }}>{d.display_number}</code>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={14}/> Refresh</Button>
          <Badge variant={d.status==='ONLINE'?'success':'danger'} dot>{d.status}</Badge>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:20 }}>
        {[
          { label:'Status',    value: <Badge variant={d.status==='ONLINE'?'success':'danger'} dot>{d.status}</Badge>, sub: fmt.ago(d.last_heartbeat) },
          { label:'Uptime Today', value: d.uptime_today_minutes ? `${Math.floor(d.uptime_today_minutes/60)}h ${d.uptime_today_minutes%60}m` : '—' },
          { label:'TV Free Storage', value: d.storage_available || '—', sub:'Reported by device' },
          { label:'Content Size', value: fmt.bytes(d.media_storage_mb || 0), sub:'Assigned files' },
          { label:'Loops Today', value: d.content_loops_today || '0', sub:'Content loops played' },
        ].map(card => (
          <div key={card.label} style={{ background:'white', borderRadius:'var(--radius-lg)', padding:'16px 18px', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:6 }}>{card.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text-heading)' }}>{card.value}</div>
            {card.sub && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom:20 }}>
        {/* Production Line */}
        <Card title="Production Line">
          {line ? (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--primary-10)', borderRadius:'var(--radius-md)', marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <GitBranch size={18} color="white"/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)' }}>{line.production_line_name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{line.description || 'No description'}</div>
                </div>
                <Badge variant={line.active_line?'success':'muted'}>{line.active_line?'Active':'Inactive'}</Badge>
              </div>
              {line.assigned_employee && (
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', marginBottom:12 }}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--secondary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <User size={16} color="white"/>
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>Assigned Employee</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-heading)', marginTop:2 }}>{line.assigned_employee}</div>
                  </div>
                </div>
              )}
              <Link href={`/admin/production-lines/${line.id}`}>
                <Button variant="secondary" size="sm" style={{ width:'100%' }}><GitBranch size={13}/> Manage Line</Button>
              </Link>
            </div>
          ) : (
            <div className="empty" style={{ padding:'24px 0' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🔗</div>
              <div className="empty__title">Not in any production line</div>
            </div>
          )}
        </Card>

        {/* Volume + Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card title="Volume Control" subtitle="Preset or slider — sends to TV instantly on release" flat>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {[0, 25, 50, 75, 100].map(v => (
                <Button key={v}
                  variant={displayVol === v ? 'primary' : 'secondary'}
                  size="sm"
                  loading={volMut.isPending && displayVol === v}
                  onClick={() => { setLocalVol(v); volMut.mutate(v); }}>
                  {v}%
                </Button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <Volume2 size={20} color="var(--primary)"/>
              <input
                type="range" min={0} max={100}
                value={displayVol}
                onChange={e  => setLocalVol(Number(e.target.value))}
                onPointerUp={e => volMut.mutate(Number(e.target.value))}
                style={{ flex:1, accentColor:'var(--primary)', height:6, cursor:'pointer' }}
              />
              <span style={{ fontWeight:800, fontSize:20, minWidth:44, color:'var(--text-heading)', textAlign:'right' }}>
                {displayVol}%
              </span>
            </div>
            {volMut.isPending && (
              <div style={{ fontSize:12, color:'var(--primary)', marginTop:8, fontWeight:600 }}>
                📡 Sending volume command to TV...
              </div>
            )}
          </Card>

          <Card title="Actions" flat>
            <Button variant="secondary" onClick={() => setPwModal(true)} style={{ width:'100%' }}>
              <Key size={14}/> Reset Display Password
            </Button>
          </Card>
        </div>
      </div>

      {/* ── PUBLISHED CONTENT — Main new section ── */}
      <Card title="Published Content" subtitle="Files currently playing on this display" style={{ marginBottom:20 }}>
        {publishedFiles.length === 0 ? (
          <div className="empty" style={{ padding:'24px 0' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📺</div>
            <div className="empty__title">No content published</div>
            <p>Use the Content &amp; Publish page to push content to this display</p>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                {publishedFiles.length} file{publishedFiles.length!==1?'s':''} in playlist{!isPublished && ' · ⏸ PAUSED'}
              </div>
              {line?.id && (
                <div style={{display:'flex',gap:6}}>
                  {isPublished ? (
                    <Button variant="warning" size="sm" loading={unpublishMut.isPending}
                      onClick={() => unpublishMut.mutate()}>
                      ⏸ Pause
                    </Button>
                  ) : (
                    <Button variant="success" size="sm" loading={republishMut.isPending}
                      onClick={() => republishMut.mutate()}>
                      ▶ Resume
                    </Button>
                  )}
                  <Button variant="danger" size="sm" loading={deleteContentMut.isPending}
                    onClick={() => { if (confirm('Delete all content from this display?')) deleteContentMut.mutate(); }}>
                    🗑 Delete
                  </Button>
                </div>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Preview</th><th>File</th><th>Type</th><th>Duration</th><th></th></tr>
                </thead>
                <tbody>
                  {publishedFiles.map((f, idx) => (
                    <tr key={f.id}>
                      <td style={{ fontSize:13, color:'var(--text-muted)', fontWeight:600 }}>{idx + 1}</td>
                      <td>
                        {f.file_type === 'image' && thumbUrl(f.file_path) ? (
                          <div style={{ width:40, height:40, borderRadius:6, overflow:'hidden', border:'1px solid var(--border)' }}>
                            <img src={thumbUrl(f.file_path)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                              onError={e => { e.target.parentElement.innerHTML = '<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px">🖼️</div>'; }}/>
                          </div>
                        ) : (
                          <div style={{ width:40, height:40, borderRadius:6, background:'var(--bg-main)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, border:'1px solid var(--border)' }}>
                            {FILE_ICON[f.file_type] || '📄'}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="table__name" style={{ fontSize:13 }}>{f.file_name}</div>
                      </td>
                      <td><Badge variant="primary">{f.file_type}</Badge></td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {isDocType(f.file_name) ? `${f.duration||50}s/page` : `${f.duration||10}s`}
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteFileTarget(f)}>
                          <Trash2 size={13} color="var(--danger)"/>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Active Assignments */}
      {/* <Card title="Content Assignments" style={{ marginBottom:20 }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              {(asgData?.assignments||[]).map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:16 }}>{FILE_ICON[a.file_type]||'📄'}</span>
                      <div className="table__name">{a.file_name}</div>
                    </div>
                  </td>
                  <td><Badge variant="primary">{a.file_type}</Badge></td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.bytes(a.file_size_mb||0)}</td>
                  <td style={{ fontSize:13 }}>{a.duration_seconds ? `${a.duration_seconds}s` : '—'}</td>
                  <td><Badge variant={a.is_active?'success':'muted'}>{a.is_active?'Active':'Inactive'}</Badge></td>
                </tr>
              ))}
              {!(asgData?.assignments?.length) && (
                <tr><td colSpan={5}><div className="empty"><div className="empty__title">No assignments yet</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card> */}

      {/* Error Logs */}
      {errors.length > 0 && (
        <Card title="Recent Errors from Device">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Type</th><th>Message</th><th>When</th></tr></thead>
              <tbody>
                {errors.map(e => (
                  <tr key={e.id}>
                    <td><Badge variant="danger">{e.error_type}</Badge></td>
                    <td style={{ fontSize:13 }}>{e.error_message}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(e.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Password Modal */}
      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Reset Display Password"
        footer={<>
          <Button variant="secondary" onClick={() => setPwModal(false)}>Cancel</Button>
          <Button variant="primary" loading={pwMut.isPending} onClick={() => pwMut.mutate(newPw)}>Update</Button>
        </>}>
        <Field label="New Password (min 6 chars)">
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password"/>
        </Field>
      </Modal>

      {/* Delete file confirm */}
      <ConfirmModal open={!!deleteFileTarget} onClose={() => setDeleteFileTarget(null)}
        title="Remove File from Playlist"
        message={`Remove "${deleteFileTarget?.file_name}" from this display's playlist?`}
        loading={delFileMut.isPending}
        onConfirm={() => delFileMut.mutate(deleteFileTarget.id)}/>
    </div>
  );
}