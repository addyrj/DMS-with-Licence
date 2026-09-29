// src/app/not-found.js
import Link from 'next/link';
export default function NotFound() {
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:20,background:'var(--bg-main)'}}>
      <div style={{fontSize:80,marginBottom:16}}>📺</div>
      <h1 style={{fontSize:32,fontWeight:800,color:'var(--text-heading)',marginBottom:8}}>404 — Page not found</h1>
      <p style={{color:'var(--text-muted)',marginBottom:24}}>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/login" style={{background:'var(--primary)',color:'white',padding:'10px 24px',borderRadius:'var(--radius-sm)',fontWeight:600,fontSize:14}}>Back to Login</Link>
    </div>
  );
}
