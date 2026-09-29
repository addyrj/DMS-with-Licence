// src/components/AdminGuard.js
// Wraps admin-only pages — redirects employees away
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

export default function AdminGuard({ children }) {
  const { user } = useAuth();
  const router   = useRouter();

  useEffect(() => {
    if (user && user.role === 'EMPLOYEE') {
      router.replace('/employee/dashboard');
    }
  }, [user, router]);

  // While redirecting or no user — show nothing
  if (!user || user.role === 'EMPLOYEE') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:48 }}>🔒</div>
        <div style={{ fontWeight:700, fontSize:18, color:'var(--text-heading)' }}>Access Denied</div>
        <p style={{ color:'var(--text-muted)', fontSize:14 }}>This page is only for admin users.</p>
      </div>
    );
  }

  return children;
}
