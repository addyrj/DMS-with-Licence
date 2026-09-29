'use client';
// src/app/(employee)/employee/displays/page.js
// List all displays in the employee's production line — clickable to detail
import { useQuery } from '@tanstack/react-query';
import { getDisplays } from '../../../../lib/api';
import { fmt } from '../../../../lib/utils';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import { ExternalLink, Volume2, Thermometer } from 'lucide-react';
import useServerPagination from '../../../../hooks/useServerPagination';
import Pagination from '../../../../components/ui/Pagination';
import Link from 'next/link';

export default function EmployeeDisplaysList() {
  const { data, isLoading, page, setPage, total, totalPages } =
    useServerPagination(['displays'], getDisplays, { limit: 12, refetchInterval: 15_000 });
  const displays = data?.displays || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Displays</h2>
          <p>{total} TV{total!==1?'s':''} in your production line</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
          {[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:180, borderRadius:'var(--radius-lg)' }}/>)}
        </div>
      ) : displays.length === 0 ? (
        <Card><div className="empty"><div className="empty__icon">📺</div><div className="empty__title">No displays in your line</div><p>Contact your admin to get displays assigned to your production line</p></div></Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
          {displays.map(d => (
            <Link key={d.id} href={`/employee/displays/${d.id}`} style={{ textDecoration:'none', color:'inherit' }}>
              <div style={{ background:'white', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)', cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='var(--shadow-sm)'}>
                {/* Status bar */}
                <div style={{ height:4, background: d.status==='ONLINE'?'var(--success)':'var(--danger)' }}/>
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)' }}>{d.display_name}</div>
                      <code style={{ fontSize:12, color:'var(--text-muted)' }}>{d.display_number}</code>
                    </div>
                    <Badge variant={d.status==='ONLINE'?'success':'danger'} dot>{d.status}</Badge>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-muted)' }}>
                      <Volume2 size={13}/> {d.volume_level||0}%
                      {d.temperature && <><Thermometer size={13}/> {d.temperature}</>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                      Last seen: {fmt.ago(d.last_heartbeat)}
                    </div>
                    <div style={{ fontSize:12, color:'var(--primary)', fontWeight:600 }}>
                      📁 {fmt.bytes(d.media_storage_mb || 0)} content
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:12, padding:'8px 10px', background:'var(--primary-10)', borderRadius:'var(--radius-sm)', color:'var(--primary)', fontSize:12, fontWeight:600 }}>
                    <ExternalLink size={13}/> View Details
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={12} onPage={setPage} />
    </div>
  );
}
