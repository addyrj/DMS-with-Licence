'use client';
// src/components/ui/SubscriptionWarning.js
// Shows a blocking popup when subscription expires within 7 days
// Cannot be dismissed permanently — comes back each day
import { useState, useEffect } from 'react';
import { useQuery }            from '@tanstack/react-query';
import { getSubscriptionStatus } from '../../lib/api';

export default function SubscriptionWarning() {
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ['subscription-status'],
    queryFn:  getSubscriptionStatus,
    staleTime: 30 * 60 * 1000,
  });

  // Reset dismiss state every day
  useEffect(() => {
    const today = new Date().toDateString();
    const lastDismissed = localStorage.getItem('sub_warning_dismissed');
    if (lastDismissed !== today) setDismissed(false);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('sub_warning_dismissed', new Date().toDateString());
    setDismissed(true);
  };

  if (!data || (!data.is_expiring && !data.is_expired) || dismissed) return null;

  const isExpired = data.is_expired;

  return (
    <>
      {/* Dark overlay */}
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
        zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          background:'white', borderRadius:16, padding:36, maxWidth:480, width:'90%',
          boxShadow:'0 24px 64px rgba(0,0,0,0.3)',
          border:`3px solid ${isExpired?'#DC2626':'#F59E0B'}`,
        }}>
          {/* Icon */}
          <div style={{ textAlign:'center', fontSize:56, marginBottom:16 }}>
            {isExpired ? '🚫' : '⚠️'}
          </div>

          {/* Title */}
          <h2 style={{
            textAlign:'center', fontSize:22, fontWeight:800, marginBottom:8,
            color: isExpired ? '#DC2626' : '#D97706',
          }}>
            {isExpired ? 'Subscription Expired' : 'Subscription Expiring Soon'}
          </h2>

          {/* Message */}
          <p style={{ textAlign:'center', fontSize:15, color:'#374151', lineHeight:1.6, marginBottom:8 }}>
            {isExpired
              ? 'Your subscription has expired. Please contact your Super Admin to renew.'
              : `Your subscription expires in ${data.days_left} day${data.days_left!==1?'s':''}.`}
          </p>

          <p style={{ textAlign:'center', fontSize:13, color:'#6B7280', marginBottom:24 }}>
            Expiry date: <strong>{new Date(data.subscription_end).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</strong>
          </p>

          {/* Stats */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:24,
            background:'#F9FAFB', borderRadius:10, padding:14,
          }}>
            {[
              { label:'Displays',    value:`${data.devices_required}` },
              { label:'Storage',     value:`${data.total_storage_gb} GB` },
              { label:'Plan Start',  value: new Date(data.subscription_start).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) },
              { label:'Plan End',    value: new Date(data.subscription_end).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontWeight:700, fontSize:15 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div style={{
            background: isExpired?'#FEF2F2':'#FFF7ED',
            border:`1px solid ${isExpired?'#FECACA':'#FDE68A'}`,
            borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#374151',
          }}>
            <strong>To renew:</strong> Contact your Super Admin or reach out to{' '}
            <strong>support@iottech.in</strong>
          </div>

          {/* Buttons */}
          <div style={{ display:'flex', gap:10 }}>
            {!isExpired && (
              <button onClick={handleDismiss} style={{
                flex:1, padding:'12px', borderRadius:8, cursor:'pointer',
                border:'1px solid #E5E7EB', background:'white',
                fontSize:14, fontWeight:600, color:'#374151',
              }}>
                Remind me tomorrow
              </button>
            )}
            <button onClick={handleDismiss} style={{
              flex:1, padding:'12px', borderRadius:8, cursor:'pointer',
              border:'none', background: isExpired?'#DC2626':'#D97706',
              fontSize:14, fontWeight:700, color:'white',
            }}>
              I understand
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
