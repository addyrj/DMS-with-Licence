// 'use client';
// import { useState, useRef, useEffect } from 'react';
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { getProfile, updateProfile, uploadOwnLogo, getSubscriptionStatus, getPaymentHistory } from '../../../../lib/api';
// import { useToast } from '../../../../components/ui/Toast';
// import Card from '../../../../components/ui/Card';
// import Button from '../../../../components/ui/Button';
// import { Field, Input } from '../../../../components/ui/Input';
// import PaymentModal from '../../../../components/ui/PaymentModal';
// import Pagination from '../../../../components/ui/Pagination';
// import useServerPagination from '../../../../hooks/useServerPagination';
// import { Camera, Building, Mail, Phone, Save, Monitor, HardDrive, Calendar, AlertTriangle, CreditCard } from 'lucide-react';

// const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

// export default function ProfilePage() {
//   const toast   = useToast();
//   const qc      = useQueryClient();
//   const fileRef = useRef();

//   const { data, isLoading } = useQuery({ queryKey:['profile'],    queryFn: getProfile });
//   const { data: subData }   = useQuery({ queryKey:['sub-status'], queryFn: getSubscriptionStatus, staleTime: 300000 });
//   const {
//     data: payData, page: payPage, setPage: setPayPage, total: payTotal, totalPages: payTotalPages,
//   } = useServerPagination(['payment-history'], getPaymentHistory, { limit: 15, staleTime: 30000 });

//   const client     = data?.client;
//   const sub        = subData || {};
//   const payHistory = payData?.history || [];

//   const [form, setForm]         = useState({ admin_email:'', contact_phone:'' });
//   const [logoUploading, setLogo] = useState(false);
//   const [preview, setPreview]   = useState(null);
//   const [payModal, setPayModal] = useState(false);

//   useEffect(() => {
//     if (client) setForm({ admin_email: client.admin_email||'', contact_phone: client.contact_phone||'' });
//   }, [client]);

//   const updateMut = useMutation({
//     mutationFn: (b) => updateProfile(b),
//     onSuccess: () => { qc.invalidateQueries({ queryKey:['profile'] }); toast('Profile updated'); },
//     onError: (e) => toast(e.message, 'danger'),
//   });

//   const handleLogoUpload = async (e) => {
//     const file = e.target.files?.[0]; if (!file) return;
//     setPreview(URL.createObjectURL(file));
//     setLogo(true);
//     try {
//       await uploadOwnLogo(file);
//       qc.invalidateQueries({ queryKey:['profile'] });
//       toast('Logo updated');
//     } catch(err) { toast(err.message, 'danger'); setPreview(null); }
//     finally { setLogo(false); }
//   };

//   // FIX: Helmet sets Cross-Origin-Resource-Policy: same-origin on the backend,
//   // so <img src="http://localhost:5004/..."> from :3000 is blocked with
//   // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin. Route through the /api/logo proxy
//   // exactly like Header.js and Sidebar.js already do.
//   // `preview` is a local blob/data URL from the file picker - leave it untouched.
//   const logoSrc = preview
//     || (client?.company_logo
//           ? `/api/logo?path=${encodeURIComponent(client.company_logo)}`
//           : null);
//   const daysLeftColor = sub.is_expired ? '#DC2626' : sub.is_expiring ? '#D97706' : '#16A34A';
//   const storageUsedPct = Math.min(100, ((sub.used_storage_gb||0) / (sub.total_storage_gb||1)) * 100);

//   if (isLoading) return <div className="page-loading"><div className="spinner"/></div>;

//   return (
//     <div>
//       <div className="page-header">
//         <div><h2>Profile</h2><p>Company information, plan details and payments</p></div>
//         <Button variant="primary" onClick={() => setPayModal(true)}>
//           <CreditCard size={14}/> Upgrade Plan
//         </Button>
//       </div>

//       {/* ── Plan stat cards ─────────────────────────────────── */}
//       <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:24 }}>

//         {/* Subscription */}
//         <div style={{ background:sub.is_expired?'#FEF2F2':sub.is_expiring?'#FFF7ED':'white', border:`1px solid ${sub.is_expired?'#FECACA':sub.is_expiring?'#FDE68A':'var(--border)'}`, borderRadius:'var(--radius-lg)', padding:16 }}>
//           <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
//             <Calendar size={16} color={daysLeftColor}/>
//             <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Subscription</span>
//           </div>
//           <div style={{ fontSize:24, fontWeight:800, color:daysLeftColor }}>
//             {sub.is_expired ? 'Expired' : sub.days_left != null ? `${sub.days_left} days` : '—'}
//           </div>
//           <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
//             {sub.subscription_end ? `Expires ${new Date(sub.subscription_end).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}` : '—'}
//           </div>
//           {(sub.is_expiring || sub.is_expired) && (
//             <div style={{ marginTop:8, fontSize:11, fontWeight:700, color:daysLeftColor, display:'flex', alignItems:'center', gap:4 }}>
//               <AlertTriangle size={11}/> {sub.is_expired ? 'Expired' : 'Expiring soon'}
//             </div>
//           )}
//           <button onClick={() => setPayModal(true)} style={{ marginTop:10, width:'100%', padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'#0D9488', color:'white', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
//             <span>💳</span> Renew Subscription
//           </button>
//         </div>

//         {/* Storage */}
//         <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
//           <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
//             <HardDrive size={16} color="var(--primary)"/>
//             <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Storage</span>
//           </div>
//           <div style={{ fontSize:24, fontWeight:800 }}>
//             {sub.used_storage_gb||0} <span style={{ fontSize:14, fontWeight:400, color:'var(--text-muted)' }}>/ {sub.total_storage_gb||0} GB</span>
//           </div>
//           <div style={{ marginTop:10, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
//             <div style={{ height:6, borderRadius:3, background: storageUsedPct>90?'#DC2626':storageUsedPct>70?'#D97706':'var(--primary)', width:`${storageUsedPct}%`, transition:'width .3s' }}/>
//           </div>
//           <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{storageUsedPct.toFixed(1)}% used</div>
//           <button onClick={() => setPayModal(true)} style={{ marginTop:10, width:'100%', padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--primary)', color:'white', fontSize:12, fontWeight:700 }}>+ Add Storage</button>
//         </div>

//         {/* Displays */}
//         <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
//           <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
//             <Monitor size={16} color="var(--primary)"/>
//             <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Displays</span>
//           </div>
//           <div style={{ fontSize:24, fontWeight:800 }}>
//             {sub.devices_required||0} <span style={{ fontSize:14, fontWeight:400, color:'var(--text-muted)' }}>allocated</span>
//           </div>
//           <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Plan: {client?.requirement||'Normal'}</div>
//           <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>₹{client?.pricing||0}/month</div>
//           <button onClick={() => setPayModal(true)} style={{ marginTop:10, width:'100%', padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'var(--primary)', color:'white', fontSize:12, fontWeight:700 }}>+ Add Displays</button>
//         </div>
//       </div>

//       <div className="profile-media-grid">
//         {/* Logo */}
//         <Card title="Company Logo">
//           <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:8 }}>
//             <div onClick={() => fileRef.current?.click()} style={{ width:140, height:140, borderRadius:'var(--radius-lg)', border:'2px dashed var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'var(--bg-main)', position:'relative' }}>
//               {logoSrc
//                 ? <img src={logoSrc} alt="logo" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
//                 : <div style={{ textAlign:'center' }}><Building size={32} color="var(--text-muted)" style={{ marginBottom:8 }}/><div style={{ fontSize:12, color:'var(--text-muted)' }}>Click to upload</div></div>}
//               <div style={{ position:'absolute', bottom:6, right:6, background:'var(--primary)', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center' }}>
//                 <Camera size={14} color="white"/>
//               </div>
//             </div>
//             <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoUpload}/>
//             <Button variant="secondary" size="sm" loading={logoUploading} onClick={() => fileRef.current?.click()}>
//               <Camera size={14}/> Change Logo
//             </Button>
//           </div>
//         </Card>

//         {/* Info */}
//         <Card title="Company Information">
//           <div className="form-grid">
//             <Field label="Company Name"><Input value={client?.company_name||''} disabled style={{ background:'var(--bg-main)', color:'var(--text-muted)' }}/></Field>
//             <Field label="Admin Username"><Input value={client?.admin_username||''} disabled style={{ background:'var(--bg-main)', color:'var(--text-muted)' }}/></Field>
//             <Field label="Email">
//               <div style={{ position:'relative' }}>
//                 <Mail size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
//                 <Input style={{ paddingLeft:38 }} type="email" value={form.admin_email} onChange={e=>setForm(f=>({...f,admin_email:e.target.value}))}/>
//               </div>
//             </Field>
//             <Field label="Phone">
//               <div style={{ position:'relative' }}>
//                 <Phone size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
//                 <Input style={{ paddingLeft:38 }} type="tel" value={form.contact_phone} onChange={e=>setForm(f=>({...f,contact_phone:e.target.value}))}/>
//               </div>
//             </Field>
//             <div style={{ display:'flex', justifyContent:'flex-end' }}>
//               <Button variant="primary" loading={updateMut.isPending} onClick={() => updateMut.mutate(form)}>
//                 <Save size={14}/> Save Changes
//               </Button>
//             </div>
//           </div>
//         </Card>
//       </div>

//       {/* Plan details */}
//       <Card title="Plan Details" style={{ marginTop:20 }}>
//         <div className="table-wrap">
//           <table className="table">
//             <tbody>
//               {[
//                 { label:'Company',            value: client?.company_name||'—' },
//                 { label:'Database',           value: client?.database_name||'—' },
//                 { label:'Plan Type',          value: client?.requirement||'Normal' },
//                 { label:'Monthly Price',      value: `₹${client?.pricing||0}` },
//                 { label:'Displays Allocated', value: `${sub.devices_required||0} TVs` },
//                 { label:'Storage Allocated',  value: `${sub.total_storage_gb||0} GB` },
//                 { label:'Storage Used',       value: `${sub.used_storage_gb||0} GB` },
//                 { label:'Subscription Start', value: sub.subscription_start ? new Date(sub.subscription_start).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—' },
//                 { label:'Subscription End',   value: sub.subscription_end   ? new Date(sub.subscription_end).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—' },
//                 { label:'Days Remaining',     value: sub.is_expired ? '⚠️ Expired' : `${sub.days_left||0} days`, highlight: sub.is_expiring||sub.is_expired },
//               ].map(row => (
//                 <tr key={row.label}>
//                   <td style={{ fontWeight:600, color:'var(--text-muted)', width:'40%' }}>{row.label}</td>
//                   <td style={{ fontWeight:row.highlight?700:400, color:row.highlight?daysLeftColor:'var(--text-body)' }}>{row.value}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </Card>

//       {/* Payment History */}
//       {payHistory.length > 0 && (
//         <Card title="💳 Payment History" style={{ marginTop:20 }}>
//           <div className="table-wrap">
//             <table className="table">
//               <thead>
//                 <tr>
//                   <th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {payHistory.map(ph => {
//                   const meta = ph.meta ? JSON.parse(ph.meta) : {};
//                   return (
//                     <tr key={ph.id}>
//                       <td style={{ fontSize:13 }}>{new Date(ph.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
//                       <td style={{ fontSize:13, fontWeight:600 }}>
//                         {ph.payment_type==='display'?'📺 Displays':ph.payment_type==='storage'?'💾 Storage':'📅 Subscription'}
//                       </td>
//                       <td style={{ fontSize:12, color:'var(--text-muted)' }}>{meta.description||'—'}</td>
//                       <td style={{ fontSize:13, fontWeight:700, color:'var(--primary)' }}>₹{((ph.amount_paise||0)/100).toLocaleString('en-IN')}</td>
//                       <td>
//                         <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, background:ph.status==='paid'?'#D1FAE5':ph.status==='failed'?'#FEE2E2':'#FEF3C7', color:ph.status==='paid'?'#065F46':ph.status==='failed'?'#991B1B':'#92400E' }}>
//                           {ph.status==='paid'?'✅ Paid':ph.status==='failed'?'❌ Failed':'⏳ Pending'}
//                         </span>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//           <Pagination page={payPage} totalPages={payTotalPages} total={payTotal} pageSize={15} onPage={setPayPage} />
//         </Card>
//       )}

//       <PaymentModal open={payModal} onClose={() => setPayModal(false)}/>
//     </div>
//   );
// }





// ----------------------------------------

// src/app/(admin)/admin/profile/page.js
'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, uploadOwnLogo } from '../../../../lib/api';
import { useToast } from '../../../../components/ui/Toast';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { Field, Input } from '../../../../components/ui/Input';
import { Camera, Building, Mail, Phone, Save } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5004';

export default function ProfilePage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const fileRef = useRef();

  const { data, isLoading } = useQuery({ queryKey:['profile'], queryFn: getProfile });
  const client = data?.client;

  const [form, setForm] = useState({ admin_email:'', contact_phone:'' });
  const [logoUploading, setLogoUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  // Populate form when data loads
  useState(() => {
    if (client) {
      setForm({ admin_email: client.admin_email||'', contact_phone: client.contact_phone||'' });
    }
  }, [client]);

  const updateMut = useMutation({
    mutationFn: () => updateProfile(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['profile'] }); toast('Profile updated!'); },
    onError:   (e) => toast(e.message, 'danger'),
  });

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show preview
    const url = URL.createObjectURL(file);
    setPreview(url);
    setLogoUploading(true);
    try {
      await uploadOwnLogo(file);
      qc.invalidateQueries({ queryKey:['profile'] });
      qc.invalidateQueries({ queryKey:['profile', undefined] });
      toast('Logo updated! Refresh to see in sidebar.');
    } catch (e) {
      toast(e.message, 'danger');
    } finally {
      setLogoUploading(false);
    }
  };

const logoUrl = preview
  || (client?.company_logo ? `/api/logo?path=${encodeURIComponent(client.company_logo)}` : null);

  return (
    <div>
      <div className="page-header">
        <div><h2>Company Profile</h2><p>Update your company information and logo</p></div>
      </div>

      <div className="two-col">
        {/* Logo card */}
        <Card title="Company Logo" subtitle="Shown in sidebar for all your users">
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, padding:'20px 0' }}>
            {/* Logo preview */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width:160, height:160, borderRadius:'var(--radius-lg)',
                border:'2px dashed var(--border)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'var(--bg-main)', overflow:'hidden', position:'relative',
                transition:'border-color .18s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor='var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
            >
              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Company logo" style={{ width:'100%', height:'100%', objectFit:'contain', padding:12 }} />
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'.18s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity=1}
                    onMouseLeave={e => e.currentTarget.style.opacity=0}
                  >
                    <Camera size={28} color="white" />
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
                  {logoUploading ? (
                    <div className="spinner" style={{ margin:'0 auto 8px' }} />
                  ) : (
                    <Camera size={32} style={{ margin:'0 auto 8px', opacity:.4 }} />
                  )}
              // NEW
<div style={{ fontSize:13 }}>Click to upload logo</div>
<div style={{ fontSize:11, marginTop:4, color:'var(--warning)', fontWeight:500 }}>
  ⚠️ Recommended: 200×56px, PNG with transparent background
</div>
<div style={{ fontSize:11, marginTop:2 }}>Max 5MB — wide logos work best</div>
                </div>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoChange} />

            <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={logoUploading}>
              <Camera size={14} /> {logoUrl ? 'Change Logo' : 'Upload Logo'}
            </Button>

            {client?.company_name && (
              <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center' }}>
                If no logo, your company initial <strong>{client.company_name.charAt(0).toUpperCase()}</strong> is shown
              </div>
            )}
          </div>
        </Card>

        {/* Profile info card */}
        <Card title="Company Information">
          <div className="form-grid" style={{ marginTop:8 }}>
            <Field label="Company Name">
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:14 }}>
                <Building size={16} color="var(--text-muted)" />
                <span style={{ color:'var(--text-body)' }}>{client?.company_name || '—'}</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>Cannot change</span>
              </div>
            </Field>

            <Field label="Admin Username">
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg-main)', borderRadius:'var(--radius-sm)', fontSize:14 }}>
                <span style={{ color:'var(--text-body)' }}>{client?.admin_username || '—'}</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>Cannot change</span>
              </div>
            </Field>

            <Field label="Admin Email">
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
                <Input
                  type="email"
                  placeholder="admin@company.com"
                  value={form.admin_email}
                  onChange={e => setForm(f => ({...f, admin_email: e.target.value}))}
                  style={{ paddingLeft:40 }}
                />
              </div>
            </Field>

            <Field label="Contact Phone">
              <div style={{ position:'relative' }}>
                <Phone size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
                <Input
                  placeholder="+91 98765 43210"
                  value={form.contact_phone}
                  onChange={e => setForm(f => ({...f, contact_phone: e.target.value}))}
                  style={{ paddingLeft:40 }}
                />
              </div>
            </Field>

            <Button
              variant="primary"
              loading={updateMut.isPending}
              onClick={() => updateMut.mutate()}
              style={{ marginTop:8 }}
            >
              <Save size={15} /> Save Changes
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
