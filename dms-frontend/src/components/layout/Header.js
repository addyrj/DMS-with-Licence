// src/components/layout/Header.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, LogOut, ChevronDown, Monitor, Users, GitBranch, FolderOpen, Building, CheckCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, getUnreadCount, getMyNotifications, markNotifRead, markAllNotifsRead } from '../../lib/api';
import MobileNav from './MobileNav';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

// ── Universal Search ──────────────────────────────────────────────────────────
function useSearch(role) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);

  const isClient = !!role && role !== 'SUPER_ADMIN';
  const isSA     = role === 'SUPER_ADMIN';

  // NOTE: list endpoints now default to a small page size server-side, so this
  // search index (which wants everything, not one page) explicitly asks for a
  // high limit to keep "search anything" covering the full set like before.
  const SEARCH_LIMIT = 200;
  const { data: displays } = useQuery({ queryKey:['displays', role], queryFn: async () => { const { getDisplays } = await import('../../lib/api'); return getDisplays({ limit: SEARCH_LIMIT }); }, enabled: isClient });
  const { data: users }    = useQuery({ queryKey:['users',    role], queryFn: async () => { const { getUsers }    = await import('../../lib/api'); return getUsers({ limit: SEARCH_LIMIT });    }, enabled: isClient });
  const { data: lines }    = useQuery({ queryKey:['lines',    role], queryFn: async () => { const { getLines }    = await import('../../lib/api'); return getLines({ limit: SEARCH_LIMIT });    }, enabled: isClient });
  const { data: folders }  = useQuery({ queryKey:['folders',  role], queryFn: async () => { const { getFolders }  = await import('../../lib/api'); return getFolders({ limit: SEARCH_LIMIT });  }, enabled: isClient });
  const { data: clients }  = useQuery({ queryKey:['clients',  role], queryFn: async () => { const { getClients }  = await import('../../lib/api'); return getClients({ limit: SEARCH_LIMIT });  }, enabled: isSA });

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const lq = q.toLowerCase();
    const hits = [];
    if (isSA) {
      (clients?.clients||[]).forEach(c => {
        if (c.company_name?.toLowerCase().includes(lq) || c.admin_username?.toLowerCase().includes(lq))
          hits.push({ type:'Client', icon: Building, label: c.company_name, sub: c.admin_username, href: `/clients/${c.id}` });
      });
    } else {
      (displays?.displays||[]).forEach(d => {
        if (d.display_name?.toLowerCase().includes(lq) || d.display_number?.toLowerCase().includes(lq))
          hits.push({ type:'Display', icon: Monitor, label: d.display_name, sub: d.display_number, href: `/admin/displays/${d.id}` });
      });
      (users?.users||[]).forEach(u => {
        if (u.username?.toLowerCase().includes(lq))
          hits.push({ type:'User', icon: Users, label: u.username, sub: u.production_line_name||'No line', href: `/admin/users` });
      });
      (lines?.lines||[]).forEach(l => {
        if (l.production_line_name?.toLowerCase().includes(lq))
          hits.push({ type:'Line', icon: GitBranch, label: l.production_line_name, sub: `${l.display_count||0} displays`, href: `/admin/production-lines/${l.id}` });
      });
      (folders?.folders||[]).forEach(f => {
        if (f.folder_name?.toLowerCase().includes(lq))
          hits.push({ type:'Folder', icon: FolderOpen, label: f.folder_name, sub: `${f.file_count} files`, href: `/admin/media/${f.folder_name}` });
      });
    }
    setResults(hits.slice(0,8));
  }, [q, displays, users, lines, folders, clients, role, isSA]);

  return { q, setQ, results };
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ user }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const isSA     = user?.role === 'SUPER_ADMIN';
  const clientId = user?.client_id;

  const { data: countData } = useQuery({
    queryKey: ['notif-count', clientId],
    queryFn:  getUnreadCount,
    enabled:  !isSA && !!clientId,
    refetchInterval: 30_000,
  });
  const { data: notifsData } = useQuery({
    queryKey: ['notifications', clientId],
    queryFn:  getMyNotifications,
    enabled:  !isSA && !!clientId && open,
  });

  const unread    = Number(countData?.count || 0);
  const notifs    = notifsData?.notifications || [];

  const readMut = useMutation({
    mutationFn: markNotifRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-count', clientId] }); qc.invalidateQueries({ queryKey: ['notifications', clientId] }); },
  });
  const readAllMut = useMutation({
    mutationFn: markAllNotifsRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-count', clientId] }); qc.invalidateQueries({ queryKey: ['notifications', clientId] }); },
  });

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const TYPE_STYLE = {
    info:    { color:'var(--primary)',   bg:'var(--primary-10)',  icon:'ℹ️' },
    feature: { color:'#8B5CF6',          bg:'rgba(139,92,246,.1)', icon:'✨' },
    warning: { color:'var(--warning)',   bg:'var(--warning-10)',  icon:'⚠️' },
    urgent:  { color:'var(--danger)',    bg:'var(--danger-10)',   icon:'🚨' },
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="app-header__icon-btn"
        style={{ position:'relative' }}
      >
        <Bell size={18} />
        {!isSA && unread > 0 && (
          <div style={{
            position:'absolute', top:4, right:4,
            minWidth:16, height:16, borderRadius:99,
            background:'var(--danger)', color:'white',
            fontSize:10, fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'0 4px', border:'2px solid white',
          }}>
            {unread > 99 ? '99+' : unread}
          </div>
        )}
      </button>

      {open && !isSA && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0,
          width:'min(360px, calc(100vw - 32px))', maxHeight:480,
          background:'white', borderRadius:'var(--radius-lg)',
          boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)',
          zIndex:200, overflow:'hidden', display:'flex', flexDirection:'column',
        }}>
          {/* Header */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)' }}>
              Notifications {unread > 0 && <span style={{ fontSize:12, color:'var(--primary)', fontWeight:600 }}>({unread} unread)</span>}
            </div>
            {unread > 0 && (
              <button onClick={() => readAllMut.mutate()}
                style={{ fontSize:12, color:'var(--primary)', fontWeight:600, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {notifs.length === 0 ? (
              <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
                <div style={{ fontSize:14, fontWeight:600 }}>No notifications</div>
                <div style={{ fontSize:12, marginTop:4 }}>You're all caught up!</div>
              </div>
            ) : (
              notifs.map(n => {
                const style = TYPE_STYLE[n.type] || TYPE_STYLE.info;
                const isUnread = !n.is_read;
                return (
                  <div key={n.id}
                    onClick={() => !n.is_read && readMut.mutate(n.id)}
                    style={{
                      padding:'14px 16px',
                      borderBottom:'1px solid var(--border)',
                      background: isUnread ? `${style.bg}` : 'white',
                      cursor: isUnread ? 'pointer' : 'default',
                      transition:'background .15s',
                      display:'flex', gap:12,
                    }}
                    onMouseEnter={e => { if (isUnread) e.currentTarget.style.background = 'var(--bg-main)'; }}
                    onMouseLeave={e => { if (isUnread) e.currentTarget.style.background = style.bg; }}
                  >
                    {/* Type icon */}
                    <div style={{ fontSize:20, flexShrink:0, lineHeight:1, marginTop:2 }}>{style.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'var(--text-heading)' }}>{n.title}</span>
                        {isUnread && <span style={{ width:8, height:8, borderRadius:'50%', background: style.color, flexShrink:0 }} />}
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-body)', lineHeight:1.5 }}>{n.message}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                        {new Date(n.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SA sees simple info panel */}
      {open && isSA && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, width:'min(280px, calc(100vw - 32px))',
          background:'white', borderRadius:'var(--radius-lg)',
          boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)',
          zIndex:200, padding:20, textAlign:'center',
        }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📢</div>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text-heading)', marginBottom:4 }}>Send Notifications</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>Go to Notifications page to send messages to clients.</div>
          <a href="/notifications" style={{ color:'var(--primary)', fontWeight:700, fontSize:13 }}>Open Notifications →</a>
        </div>
      )}
    </div>
  );
}

// ── Main Header ───────────────────────────────────────────────────────────────
export default function Header() {
  const { user, logout } = useAuth();
  const router           = useRouter();
  const [searchFocus, setSearchFocus] = useState(false);
  const [userMenu,    setUserMenu]    = useState(false);
  const searchRef = useRef();
  const menuRef   = useRef();

  const { q, setQ, results } = useSearch(user?.role);

  const { data: profileData } = useQuery({
    queryKey: ['profile', user?.client_id],
    queryFn:  getProfile,
    enabled:  !!user && user.role !== 'SUPER_ADMIN',
    staleTime: 5 * 60 * 1000,
  });
  const clientProfile = profileData?.client;

  useEffect(() => {
    const handler = (e) => {
      if (!searchRef.current?.contains(e.target)) setSearchFocus(false);
      if (!menuRef.current?.contains(e.target))   setUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const roleLabel   = user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'CLIENT_ADMIN' ? 'Admin Panel' : 'Employee';
  const logoUrl     = user.role === 'SUPER_ADMIN' ? '/logo.png' : clientProfile?.company_logo ? `/api/logo?path=${encodeURIComponent(clientProfile.company_logo)}` : null;
  const companyName = user.role === 'SUPER_ADMIN' ? 'IOTtech Smart' : clientProfile?.company_name || user.username;
  const initial     = companyName.charAt(0).toUpperCase();

  const TYPE_COLORS = { Display:'var(--primary)', User:'var(--secondary)', Line:'#8B5CF6', Folder:'#F59E0B', Client:'#EC4899' };

  return (
    <header className="app-header" style={{ gap:16 }}>

      {/* Mobile hamburger — hidden on desktop, revealed by MobileNav's own <=768px style */}
      <MobileNav />

      {/* LEFT: Logo + Company + Role */}
      {/* <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ width:44, height:44, borderRadius:10, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-main)' }}>
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} style={{ width:'100%', height:'100%', objectFit:'contain' }}
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
          ) : null}
          <div style={{ display: logoUrl ? 'none' : 'flex', width:44, height:44, borderRadius:10, background:'var(--primary)', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:18 }}>
            {initial}
          </div>
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text-heading)', whiteSpace:'nowrap' }}>{companyName}</div>
          <div style={{ fontSize:11, color:'var(--primary)', fontWeight:600 }}>{roleLabel}</div>
        </div>
      </div> */}

      {/* CENTER: Universal Search */}
      <div ref={searchRef} style={{ flex:1, maxWidth:480, position:'relative' }}>
        <div className="app-header__search" style={{
          display:'flex', alignItems:'center', gap:8,
          background:'var(--bg-main)',
          border:`1.5px solid ${searchFocus ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius:99, transition:'border-color .18s',
        }}>
          <Search size={15} color="var(--text-muted)" style={{ flexShrink:0 }} />
          <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => setSearchFocus(true)}
            placeholder="Search anything..."
            style={{ flex:1, border:'none', background:'transparent', color:'var(--text-heading)', outline:'none' }} />
          {q && <button onClick={() => setQ('')} style={{ color:'var(--text-muted)', fontSize:16, lineHeight:1 }}>✕</button>}
        </div>
        {searchFocus && q.length > 0 && (
          <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, right:0, background:'white', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', overflow:'hidden', zIndex:100 }}>
            {results.length === 0 ? (
              <div style={{ padding:'20px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No results for "{q}"</div>
            ) : (
              <>
                <div style={{ padding:'8px 14px 4px', fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                  {results.length} result{results.length>1?'s':''}
                </div>
                {results.map((r,i) => (
                  <button key={i} onClick={() => { router.push(r.href); setQ(''); setSearchFocus(false); }}
                    style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'10px 14px', background:'transparent', transition:'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-main)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:32, height:32, borderRadius:8, background:`${TYPE_COLORS[r.type]}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <r.icon size={15} color={TYPE_COLORS[r.type]} />
                    </div>
                    <div style={{ minWidth:0, textAlign:'left' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-heading)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.type} · {r.sub}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Bell + User */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>

        {/* Live notification bell */}
        <NotificationBell user={user} />

        {/* User menu */}
        <div ref={menuRef} style={{ position:'relative' }}>
          <button onClick={() => setUserMenu(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px 6px 6px', border:'1px solid var(--border)', borderRadius:99, background:'white', cursor:'pointer', transition:'border-color .18s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
            <div className="app-header__user-avatar" style={{ borderRadius:'50%', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, flexShrink:0 }}>
              {user.username?.charAt(0).toUpperCase()}
            </div>
            <div className="app-header__user-text" style={{ textAlign:'left' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-heading)', lineHeight:1.2 }}>{user.username}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.2 }}>{roleLabel}</div>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" style={{ transition:'transform .18s', transform: userMenu?'rotate(180deg)':'none' }} />
          </button>
          {userMenu && (
            <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'white', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', width:'min(200px, calc(100vw - 32px))', overflow:'hidden', zIndex:100 }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-heading)' }}>{user.username}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{roleLabel}</div>
              </div>
              <button onClick={logout}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 16px', color:'var(--danger)', fontSize:13, fontWeight:600, background:'transparent', transition:'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--danger-10)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
