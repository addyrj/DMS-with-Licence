'use client';
// src/components/ui/PaymentModal.js
// Razorpay payment modal for admin — buy displays, storage, subscription
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from './Toast';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

const get   = (path) => fetch(`${BASE}${path}`, { headers: { Authorization:`Bearer ${document.cookie.match(/dms_token=([^;]+)/)?.[1]||''}` } }).then(r=>r.json());
const post  = (path, body) => fetch(`${BASE}${path}`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${document.cookie.match(/dms_token=([^;]+)/)?.[1]||''}` }, body:JSON.stringify(body) }).then(r=>r.json());

const TYPES = [
  { id:'display',      icon:'📺', label:'Add Displays',       unit:'display',   unitLabel:'TV',  priceEach:200 },
  { id:'storage',      icon:'💾', label:'Add Storage',        unit:'storage',   unitLabel:'GB',  priceEach:200 },
  { id:'subscription', icon:'📅', label:'Renew Subscription', unit:'month',     unitLabel:'month', priceEach:null },
];

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PaymentModal({ open, onClose }) {
  const toast = useToast();
  const qc    = useQueryClient();
  const [type, setType]       = useState('display');
  const [qty, setQty]         = useState(1);
  const [months, setMonths]   = useState(1);
  const [paying, setPaying]   = useState(false);

  const { data: quote } = useQuery({
    queryKey: ['payment-quote'], queryFn: () => get('/api/payment/quote').then(d=>d),
    enabled: open, staleTime: 60000,
  });

  if (!open) return null;

  const selectedType = TYPES.find(t => t.id === type);
  const pricePerMonth  = (quote?.current_displays || 0) * 200;
  const total = type === 'display' ? qty * 200
              : type === 'storage' ? qty * 200
              : pricePerMonth * months;

  // const handlePay = async () => {
  //   setPaying(true);
  //   try {
  //     const loaded = await loadRazorpay();
    const handlePay = async () => {
    // ── Offline check: block payment attempt before anything else ──
    if (!navigator.onLine) {
      toast('You are offline. Please connect to the internet before making a payment.', 'danger');
      return;
    }
    setPaying(true);
    try {
      const loaded = await loadRazorpay();

      // Create order
      const orderRes = await post('/api/payment/create-order', { type, quantity: qty, months });
      if (!orderRes.order_id) { toast(orderRes.error||'Order creation failed', 'danger'); setPaying(false); return; }

      // Mock payment for test mode
      if (orderRes.order_id.startsWith('mock_')) {
        const verifyRes = await post('/api/payment/verify', {
          razorpay_order_id:  orderRes.order_id,
          razorpay_payment_id:'mock_pay_' + Date.now(),
          razorpay_signature: 'mock_sig',
          payment_db_id:       orderRes.payment_id,
          type, quantity: qty, months,
        });
        if (verifyRes.success) {
          qc.invalidateQueries({ queryKey:['profile'] });
          qc.invalidateQueries({ queryKey:['sub-status'] });
          qc.invalidateQueries({ queryKey:['payment-quote'] });
          toast(`✅ ${verifyRes.message}`);
          onClose();
        } else { toast(verifyRes.error||'Payment failed', 'danger'); }
        setPaying(false);
        return;
      }

      // Real Razorpay
      if (!loaded) { toast('Razorpay SDK failed to load', 'danger'); setPaying(false); return; }
      const options = {
        key:           orderRes.razorpay_key,
        amount:        orderRes.amount_paise,
        currency:      'INR',
        name:          'DMS — Digital Signage',
        description:   orderRes.description,
        order_id:      orderRes.order_id,
        handler: async (response) => {
          const verifyRes = await post('/api/payment/verify', {
            ...response,
            payment_db_id: orderRes.payment_id,
            type, quantity: qty, months,
          });
          if (verifyRes.success) {
            qc.invalidateQueries({ queryKey:['profile'] });
            qc.invalidateQueries({ queryKey:['sub-status'] });
            toast(`✅ ${verifyRes.message}`);
            onClose();
          } else { toast(verifyRes.error||'Verification failed', 'danger'); }
        },
        prefill:    { name: orderRes.client_name },
        theme:      { color: '#0D9488' },
        modal:      { ondismiss: () => setPaying(false) },
      };
      new window.Razorpay(options).open();
    } catch(e) { toast(e.message, 'danger'); setPaying(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:16, padding:32, width:'100%', maxWidth:520, boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>💳 Add to Your Plan</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6B7280' }}>✕</button>
        </div>

        {/* Type selector */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:24 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={()=>setType(t.id)} style={{
              padding:'12px 8px', borderRadius:10, cursor:'pointer', textAlign:'center',
              border:`2px solid ${type===t.id?'#0D9488':'#E5E7EB'}`,
              background: type===t.id?'#F0FDFA':'white', transition:'all .15s',
            }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{t.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color: type===t.id?'#0D9488':'#374151' }}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* Quantity/Months */}
        <div style={{ background:'#F9FAFB', borderRadius:12, padding:20, marginBottom:20 }}>
          {type === 'subscription' ? (
            <>
              <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>Number of months</div>
              <div style={{ display:'flex', gap:8 }}>
                {[1,2,3,6,12].map(m => (
                  <button key={m} onClick={()=>setMonths(m)} style={{
                    flex:1, padding:'10px 4px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700,
                    border:`2px solid ${months===m?'#0D9488':'#E5E7EB'}`,
                    background: months===m?'#0D9488':'white', color: months===m?'white':'#374151',
                  }}>{m}mo</button>
                ))}
              </div>
              <div style={{ marginTop:12, fontSize:12, color:'#6B7280' }}>
                Based on {quote?.current_displays||0} displays × ₹200/display/month
              </div>
              <div style={{ marginTop:4, fontSize:12, color:'#6B7280' }}>
                Current expiry: <strong>{quote?.subscription_end ? new Date(quote.subscription_end).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}</strong>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>
                How many {type === 'display' ? 'displays' : 'GB'} to add?
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{ width:36, height:36, borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:18, cursor:'pointer', fontWeight:700 }}>−</button>
                <div style={{ flex:1, textAlign:'center', fontSize:28, fontWeight:800 }}>{qty}</div>
                <button onClick={()=>setQty(q=>q+1)} style={{ width:36, height:36, borderRadius:8, border:'1px solid #E5E7EB', background:'white', fontSize:18, cursor:'pointer', fontWeight:700 }}>+</button>
              </div>
              <div style={{ marginTop:8, fontSize:12, color:'#6B7280', textAlign:'center' }}>
                {type==='display' ? `Current: ${quote?.current_displays||0} displays` : `Current: ${quote?.current_storage_gb||0} GB`}
              </div>
            </>
          )}
        </div>

        {/* Total */}
        <div style={{ background:'#F0FDFA', border:'2px solid #0D9488', borderRadius:12, padding:16, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:12, color:'#0D9488', fontWeight:700, marginBottom:2 }}>TOTAL AMOUNT</div>
            <div style={{ fontSize:28, fontWeight:800, color:'#0D9488' }}>₹{total.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ fontSize:12, color:'#374151', textAlign:'right' }}>
            {type==='display' && <>{qty} display{qty!==1?'s':''} × ₹200/mo</>}
            {type==='storage' && <>{qty} GB × ₹200/mo</>}
            {type==='subscription' && <>{months} month{months!==1?'s':''} × ₹{pricePerMonth}</>}
          </div>
        </div>

        {/* Pay button */}
        <button onClick={handlePay} disabled={paying} style={{
          width:'100%', padding:'14px', borderRadius:10, border:'none', cursor:paying?'not-allowed':'pointer',
          background: paying?'#9CA3AF':'#0D9488', color:'white', fontSize:16, fontWeight:800,
        }}>
          {paying ? '⏳ Processing...' : `Pay ₹${total.toLocaleString('en-IN')} via Razorpay`}
        </button>

        <p style={{ textAlign:'center', fontSize:11, color:'#9CA3AF', marginTop:12, margin:0 }}>
          Secured by Razorpay · UPI / Cards / Net Banking / Wallets
        </p>
      </div>
    </div>
  );
}
