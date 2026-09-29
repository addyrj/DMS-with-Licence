// src/components/layout/MobileNav.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { Menu, X, LogOut } from 'lucide-react';
import { navForRole } from './navConfig';

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  if (!user) return null;

  const nav = navForRole(user.role);

  const isActive = (href) =>
    pathname === href || (href.length > 1 && pathname.startsWith(href));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mobile-menu-btn"
        style={{width:40,height:40,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',
          background:'white',alignItems:'center',justifyContent:'center',cursor:'pointer',display:'none'}}
      >
        <Menu size={20} color="var(--text-body)" />
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:200,backdropFilter:'blur(2px)'}} />
      )}

      <div className="mobile-drawer" style={{
        position:'fixed',left:0,top:0,bottom:0,width:280,background:'white',
        zIndex:201,transform:open?'translateX(0)':'translateX(-100%)',
        transition:'transform .25s ease',display:'flex',flexDirection:'column',
        padding:'20px 16px',boxShadow:'var(--shadow-lg)',
      }}>
        <div className="mobile-drawer__header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,paddingBottom:20,borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div className="mobile-drawer__logo-icon" style={{width:36,height:36,borderRadius:'var(--radius-sm)',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800}}>D</div>
            <span className="mobile-drawer__logo-text" style={{fontWeight:700,fontSize:17,color:'var(--text-heading)'}}>DMS</span>
          </div>
          <button onClick={() => setOpen(false)} className="mobile-drawer__close" style={{width:32,height:32,borderRadius:'var(--radius-sm)',background:'var(--bg-main)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <X size={16} color="var(--text-muted)" />
          </button>
        </div>

        <nav style={{flex:1,display:'flex',flexDirection:'column',gap:2}}>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className="mobile-drawer__item"
              style={{display:'flex',alignItems:'center',gap:10,padding:'11px 12px',borderRadius:'var(--radius-sm)',
                fontWeight:500,fontSize:14,textDecoration:'none',transition:'all var(--transition)',
                background: isActive(href) ? 'var(--primary)' : 'transparent',
                color:      isActive(href) ? 'white' : 'var(--text-body)',
              }}>
              <Icon size={18} />{label}
            </Link>
          ))}
        </nav>

        <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:16}}>
          <div className="mobile-drawer__user" style={{fontSize:13,color:'var(--text-muted)',marginBottom:10,padding:'0 12px'}}>{user.username} · {user.role}</div>
          <button onClick={logout} className="mobile-drawer__logout" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',width:'100%',borderRadius:'var(--radius-sm)',border:'none',background:'var(--danger-10)',color:'var(--danger)',fontWeight:600,fontSize:14,cursor:'pointer'}}>
            <LogOut size={16} />Log out
          </button>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){.mobile-menu-btn{display:flex!important}}
        @media(max-width:480px){
          .mobile-drawer{width:230px!important;padding:16px 12px!important}
          .mobile-drawer__header{margin-bottom:18px!important;padding-bottom:14px!important}
          .mobile-drawer__logo-icon{width:28px!important;height:28px!important;font-size:13px!important}
          .mobile-drawer__logo-text{font-size:14px!important}
          .mobile-drawer__close{width:26px!important;height:26px!important}
          .mobile-drawer__close svg{width:13px!important;height:13px!important}
          .mobile-drawer__item{padding:9px 10px!important;font-size:12px!important;gap:8px!important}
          .mobile-drawer__item svg{width:15px!important;height:15px!important}
          .mobile-drawer__user{font-size:11px!important}
          .mobile-drawer__logout{padding:8px 10px!important;font-size:12px!important}
          .mobile-drawer__logout svg{width:13px!important;height:13px!important}
        }
      `}</style>
    </>
  );
}
