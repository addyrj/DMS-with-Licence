// src/components/layout/Sidebar.js
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useQuery } from '@tanstack/react-query';
import { getProfile } from '../../lib/api';
import { navForRole } from './navConfig';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const { data: profileData } = useQuery({
    queryKey: ['profile', user?.client_id],
    queryFn:  getProfile,
    enabled:  !!user && user.role !== 'SUPER_ADMIN',
    staleTime: 5 * 60 * 1000,
  });
  const clientProfile = profileData?.client;

  if (!user) return null;

  const nav = navForRole(user.role);

  const isActive = (href) => {
    // Exact match OR starts-with for sub-pages (e.g. /admin/displays/123)
    // BUT use exact match when href could be a prefix of another nav item
    if (pathname === href) return true;
    // Avoid /employee/media matching /employee/media-bucket
    if (href.length > 1 && pathname.startsWith(href)) {
      // Only match if the next character is '/' or end of string
      const next = pathname[href.length];
      return next === '/' || next === undefined;
    }
    return false;
  };

  const renderLogo = () => {
    // ── Super Admin: show company logo full-width ─────────────────────
    if (user.role === 'SUPER_ADMIN') {
      return (
        <div style={{
          padding: '4px 4px 20px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
        }}>
          <img
            src="/logo.png"
            alt="Company Logo"
            style={{
              width: '100%',
              maxHeight: 56,
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
            onError={e => {
              // Fallback if logo.png missing
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback */}
          <div style={{ display:'none', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:'var(--radius-sm)', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:18 }}>D</div>
            <span style={{ fontWeight:700, fontSize:18, color:'var(--text-heading)' }}>DMS</span>
          </div>
        </div>
      );
    }

    // ── Client Admin / Employee: show uploaded logo or company initial ──
    const rawLogo     = clientProfile?.company_logo;
    const companyName = clientProfile?.company_name || user.username;
    const initial     = companyName.charAt(0).toUpperCase();

    // Use Next.js API proxy to avoid cross-origin image blocking
    // /api/logo?path=/uploads/logos/client_4.png serves from same origin (localhost:3000)
    const logoUrl = rawLogo
      ? `/api/logo?path=${encodeURIComponent(rawLogo)}`
      : null;

    if (logoUrl) {
      return (
        <div style={{
          padding: '4px 4px 20px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
        }}>
          {/* Full-width logo — like SA logo */}
          <img
            src={logoUrl}
            alt={companyName}
            style={{
              width: '100%',
              maxHeight: 56,
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
            onError={e => {
              // If image fails to load, show fallback with initial + name
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback shown when image fails */}
          <div style={{ display:'none', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:'var(--radius-sm)', background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:16, flexShrink:0 }}>
              {initial}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text-heading)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{companyName}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{user.role === 'CLIENT_ADMIN' ? 'Admin Panel' : 'Employee'}</div>
            </div>
          </div>
        </div>
      );
    }

    // No logo uploaded — show initial + company name
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 4px 20px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        <div style={{
          width: 38, height: 38,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text-heading)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {companyName}
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
            {user.role === 'CLIENT_ADMIN' ? 'Admin Panel' : 'Employee'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="sidebar">
      {renderLogo()}

      <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-muted)', padding:'0 12px', marginBottom:8 }}>
        MENU
      </div>

      <nav className="sidebar__nav">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar__item${isActive(href) ? ' sidebar__item--active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__promo">
          <h4>
            {user.role === 'SUPER_ADMIN' ? '🔐 Super Admin'
           : user.role === 'CLIENT_ADMIN' ? '🏢 Admin Panel'
           : '👤 Employee'}
          </h4>
          <div style={{ fontSize:12, opacity:.85, marginTop:4 }}>{user.username}</div>
        </div>
        {/* Logout moved to header top-right */}
      </div>
    </aside>
  );
}
