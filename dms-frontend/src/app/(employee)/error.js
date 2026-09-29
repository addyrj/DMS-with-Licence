// error.js — per route group error boundary
'use client';
import { useEffect } from 'react';
import Button from '../../components/ui/Button';
export default function ErrorPage({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',textAlign:'center',gap:12}}>
      <div style={{fontSize:48}}>⚠️</div>
      <h2 style={{fontSize:20,fontWeight:700,color:'var(--text-heading)'}}>Something went wrong</h2>
      <p style={{color:'var(--text-muted)',fontSize:14,maxWidth:360}}>{error?.message || 'An unexpected error occurred'}</p>
      <Button variant="primary" onClick={reset}>Try Again</Button>
    </div>
  );
}
