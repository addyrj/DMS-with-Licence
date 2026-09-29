'use client';
// src/app/(employee)/employee/displays/[id]/page.js
// NEW: Employee display detail page
// Shows: status, volume control, currently playing files, their assignments
// Employee can: adjust volume (MQTT fires), toggle/delete own assignments
// Employee cannot: reset password, delete published files, see all errors
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDisplay, setVolume, getAssignmentsByDisplay,
  toggleAssignment, deleteAssignment, getContentByLine,
  unpublishContent, republishContent, deletePublishedContent,
  getLineByDisplay,
} from '../../../../../lib/api';
import { fmt, thumbUrl, isDocType } from '../../../../../lib/utils';
import Card from '../../../../../components/ui/Card';
import Badge from '../../../../../components/ui/Badge';
import Button from '../../../../../components/ui/Button';
import ConfirmModal from '../../../../../components/ui/ConfirmModal';
import { useToast } from '../../../../../components/ui/Toast';
import { ArrowLeft, Volume2, RefreshCw, GitBranch, Trash2 } from 'lucide-react';
import Link from 'next/link';

const FILE_ICON = { video:'🎬', image:'🖼️', pdf:'📄', presentation:'📊' };

export default function EmployeeDisplayDetail() {
  const { id } = useParams();
  const router = useRouter();
  const toast  = useToast();
  const qc     = useQueryClient();

  const [localVol,   setLocalVol]   = useState(null);
  const [deleteAsgM, setDeleteAsgM] = useState(null);

  const { data, refetch } = useQuery({
    queryKey: ['emp-display', id],
    queryFn:  () => getDisplay(id),
    refetchInterval: 15_000,
  });

  const { data: asgData, refetch: refetchAsg } = useQuery({
    queryKey: ['emp-display-asg', id],
    queryFn:  () => getAssignmentsByDisplay(id, { limit: 100 }),
  });

  const { data: lineData } = useQuery({
    queryKey: ['emp-display-line', id],
    queryFn:  () => getLineByDisplay(id),
  });

  const d    = data?.display;
  const line = lineData?.line;
  const assignments = asgData?.assignments || [];

  // Individual display pause/resume/delete
  const unpublishMut = useMutation({
    mutationFn: () => unpublishContent({ production_line_id: line?.id, display_id: Number(id) }),
    onSuccess: () => { refetchContent(); toast('Content paused'); },
    onError: (e) => toast(e.message,'danger'),
  });
  const republishMut = useMutation({
    mutationFn: () => republishContent({ production_line_id: line?.id, display_id: Number(id) }),
    onSuccess: () => { refetchContent(); toast('Content resumed'); },
    onError: (e) => toast(e.message,'danger'),
  });
  const deleteContentMut = useMutation({
    mutationFn: () => deletePublishedContent({ production_line_id: line?.id, display_id: Number(id) }),
    onSuccess: () => { refetchContent(); toast('Content deleted'); },
    onError: (e) => toast(e.message,'danger'),
  });

  // Load currently published files via content by line
  const { data: contentData } = useQuery({
    queryKey: ['emp-display-content', id, line?.id],
    queryFn:  () => getContentByLine(line.id, { limit: 100 }),
    enabled:  !!line?.id,
  });
  const _tvContent = contentData?.tvs?.find(t => String(t.id) === String(id));
  const allFiles = _tvContent?.files || [];
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
    onSuccess: () => { qc.invalidateQueries({ queryKey:['emp-display', id] }); toast(`Volume set to ${displayVol}%`); },
    onError: (e) => toast(e.message, 'danger'),
  });

  const toggleAsgMut = useMutation({
    mutationFn: (asgId) => toggleAssignment(asgId),
    onSuccess: () => refetchAsg(),
    onError: (e) => toast(e.message, 'danger'),
  });

  const delAsgMut = useMutation({
    mutationFn: (asgId) => deleteAssignment(asgId),
    onSuccess: () => { refetchAsg(); setDeleteAsgM(null); toast('Assignment removed'); },
    onError: (e) => toast(e.message, 'danger'),
  });

  if (!d) return (
    <div style={{ padding:40, textAlign:'center' }}><div className="spinner spinner--lg" style={{ margin:'0 auto' }}/></div>
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/employee/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft size={16}/></Button>
          </Link>
          <div>
            <h2>{d.display_name}</h2>
            <code style={{ fontSize:13, color:'var(--text-muted)' }}>{d.display_number}</code>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={14}/></Button>
          <Badge variant={d.status==='ONLINE'?'success':'danger'} dot>{d.status}</Badge>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Status',       value: <Badge variant={d.status==='ONLINE'?'success':'danger'} dot>{d.status}</Badge>, sub: fmt.ago(d.last_heartbeat) },
          { label:'Device Free',  value: d.storage_available || '—', sub:'TV storage' },
          { label:'Content Size', value: fmt.bytes(d.media_storage_mb || 0), sub:'Assigned' },
          { label:'Loops Today',  value: d.content_loops_today || '0', sub:'Played' },
        ].map(card => (
          <div key={card.label} style={{ background:'white', borderRadius:'var(--radius-lg)', padding:'14px 16px', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:5 }}>{card.label}</div>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--text-heading)' }}>{card.value}</div>
            {card.sub && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom:20 }}>
        {/* Volume control */}
        <Card title="Volume" subtitle="Sends to TV instantly when you release the slider" flat>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {[0,25,50,75,100].map(v => (
              <Button key={v} variant={displayVol===v?'primary':'secondary'} size="sm"
                loading={volMut.isPending && displayVol===v}
                onClick={() => { setLocalVol(v); volMut.mutate(v); }}>
                {v}%
              </Button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Volume2 size={18} color="var(--primary)"/>
            <input type="range" min={0} max={100} value={displayVol}
              onChange={e => setLocalVol(Number(e.target.value))}
              onPointerUp={e => volMut.mutate(Number(e.target.value))}
              style={{ flex:1, accentColor:'var(--primary)', height:6, cursor:'pointer' }}/>
            <span style={{ fontWeight:800, fontSize:18, minWidth:42, color:'var(--text-heading)', textAlign:'right' }}>
              {displayVol}%
            </span>
          </div>
          {volMut.isPending && (
            <div style={{ fontSize:12, color:'var(--primary)', marginTop:6, fontWeight:600 }}>
              📡 Sending to TV...
            </div>
          )}
        </Card>

        {/* Production line info */}
        <Card title="My Production Line" flat>
          {line ? (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--primary-10)', borderRadius:'var(--radius-md)' }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <GitBranch size={18} color="white"/>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{line.production_line_name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{line.description || 'No description'}</div>
                <Badge variant={line.active_line?'success':'muted'} style={{ marginTop:4 }}>{line.active_line?'Active':'Inactive'}</Badge>
              </div>
            </div>
          ) : (
            <div className="empty" style={{ padding:'20px 0' }}>
              <div className="empty__title">Not in a production line</div>
            </div>
          )}
        </Card>
      </div>

      {/* Currently Playing — read only */}
      <Card title="Published Content" subtitle="Files currently playing on this display" style={{ marginBottom:20 }}>
        {publishedFiles.length === 0 ? (
          <div className="empty" style={{ padding:'20px 0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📺</div>
            <div className="empty__title">No content published yet</div>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                {publishedFiles.length} file{publishedFiles.length!==1?'s':''} in playlist{!isPublished && ' · ⏸ PAUSED'}
              </div>
              {line?.id && (
                <div style={{display:'flex',gap:6}}>
                  <Button variant="warning" size="sm" loading={unpublishMut.isPending}
                    onClick={() => unpublishMut.mutate()}>⏸ Pause</Button>
                  <Button variant="success" size="sm" loading={republishMut.isPending}
                    onClick={() => republishMut.mutate()}>▶ Resume</Button>
                  <Button variant="danger" size="sm" loading={deleteContentMut.isPending}
                    onClick={() => {if(confirm('Delete content?')) deleteContentMut.mutate();}}>🗑 Delete</Button>
                </div>
              )}
            </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Preview</th><th>File</th><th>Type</th><th>Duration</th></tr></thead>
              <tbody>
                {publishedFiles.map((f, idx) => (
                  <tr key={f.id}>
                    <td style={{ fontSize:12, color:'var(--text-muted)', fontWeight:700 }}>{idx+1}</td>
                    <td>
                      {f.file_type==='image' && thumbUrl(f.file_path) ? (
                        <div style={{ width:38, height:38, borderRadius:5, overflow:'hidden', border:'1px solid var(--border)' }}>
                          <img src={thumbUrl(f.file_path)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                            onError={e => { e.target.parentElement.innerHTML='<div style="font-size:18px;padding:8px">🖼️</div>'; }}/>
                        </div>
                      ) : <span style={{ fontSize:20 }}>{FILE_ICON[f.file_type]||'📄'}</span>}
                    </td>
                    <td><div className="table__name" style={{ fontSize:12 }}>{f.file_name}</div></td>
                    <td><Badge variant="primary">{f.file_type}</Badge></td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                      {isDocType(f.file_name) ? `${f.duration||50}s/pg` : `${f.duration||10}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      {/* My Assignments */}
      {/* <Card title="Content Assignments" subtitle="Files you assigned directly to this display">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>File</th><th>Type</th><th>Duration</th><th>Active</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id}>
                  <td><div className="table__name">{a.file_name}</div></td>
                  <td><Badge variant="primary">{a.file_type}</Badge></td>
                  <td style={{ fontSize:12 }}>{a.duration_seconds ? `${a.duration_seconds}s` : '—'}</td>
                  <td>
                    <button onClick={() => toggleAsgMut.mutate(a.id)}
                      style={{ padding:'4px 10px', borderRadius:99, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                        background: a.is_active?'var(--success)':'var(--border)',
                        color: a.is_active?'white':'var(--text-muted)' }}>
                      {a.is_active ? '● ON' : '○ OFF'}
                    </button>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmt.ago(a.created_at)}</td>
                  <td><Button variant="ghost" size="sm" onClick={() => setDeleteAsgM(a)}><Trash2 size={13} color="var(--danger)"/></Button></td>
                </tr>
              ))}
              {!assignments.length && (
                <tr key="emp-asg-empty"><td colSpan={6}>
                  <div className="empty"><div className="empty__title">No assignments for this display</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card> */}

      <ConfirmModal open={!!deleteAsgM} onClose={() => setDeleteAsgM(null)}
        title="Remove Assignment" message={`Remove "${deleteAsgM?.file_name}" from this display?`}
        loading={delAsgMut.isPending} onConfirm={() => delAsgMut.mutate(deleteAsgM.id)}/>
    </div>
  );
}