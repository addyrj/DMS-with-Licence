'use client';
// src/app/(employee)/employee/dashboard/page.js
// UPDATED:
// - Display card now has "View Details" link → /employee/displays/[id]
// - Removed "Upload Content" button (merged into Publish Content page)
// - "Publish Content" button navigates to /employee/publish
import { useAuth } from '../../../../lib/auth';
import { useQuery } from '@tanstack/react-query';
import { getUsers, getDisplays } from '../../../../lib/api';
import Card from '../../../../components/ui/Card';
import Badge from '../../../../components/ui/Badge';
import Button from '../../../../components/ui/Button';
import StatCard from '../../../../components/ui/StatCard';
import Link from 'next/link';
import { Monitor, Send, GitBranch, ExternalLink } from 'lucide-react';

export default function EmployeeDashboard() {
  const { user } = useAuth();

  // Full list — need to find "me" by username, which could be beyond page 1.
  const { data: usersData } = useQuery({ queryKey:['users-all'], queryFn: () => getUsers({ limit: 500 }) });
  const me = usersData?.users?.find(u => u.username === user?.username);

  // All displays in their production line — backend already scopes this to the
  // employee's assigned line, so it's the correct source for "my displays"
  // rather than the old single assigned_display_id field, which is rarely set.
  const { data: displaysData } = useQuery({ queryKey:['displays-all'], queryFn: () => getDisplays({ limit: 500 }) });
  const lineDisplays = displaysData?.displays || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Dashboard</h2>
          <p>Welcome back, {user?.username}</p>
        </div>
        <Link href="/employee/publish">
          <Button variant="primary"><Send size={16}/> Publish Content</Button>
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        <StatCard icon={GitBranch} label="My Production Line" value={me?.production_line_name || '—'} color="primary"/>
      </div>

      {/* Quick actions */}
      <Card title="Quick Actions" style={{ marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
          {[
            { label:'Publish Content',   href:'/employee/publish',      icon:'📺', desc:'Push files to TVs' },
            { label:'Upload to Library', href:'/employee/media-bucket', icon:'📁', desc:'Add files to your bucket' },
            { label:'My Displays',       href:'/employee/displays',     icon:'🖥️', desc:'View & manage TVs' },
          ].map(a => (
            <Link key={a.href} href={a.href}>
              <div style={{ padding:'16px', background:'var(--bg-main)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ fontSize:28, marginBottom:8 }}>{a.icon}</div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{a.label}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* My displays — sourced from the assigned production line (backend already
          scopes /api/displays to it for employees), not the old single-display field */}
      <Card title="My Displays" subtitle="All TVs you're responsible for">
          {lineDisplays.length === 0 ? (
            <div className="empty">
              <div className="empty__icon">📺</div>
              <div className="empty__title">No displays found</div>
              <p>You may not have a production line assigned yet</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {lineDisplays.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: d.status==='ONLINE'?'var(--success)':'var(--danger)', flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.display_name}</div>
                    <code style={{ fontSize:11, color:'var(--text-muted)' }}>{d.display_number}</code>
                  </div>
                  <Badge variant={d.status==='ONLINE'?'success':'danger'}>{d.status}</Badge>
                  <Link href={`/employee/displays/${d.id}`}>
                    <Button variant="ghost" size="sm" title="View details">
                      <ExternalLink size={13} color="var(--primary)"/>
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
    </div>
  );
}
