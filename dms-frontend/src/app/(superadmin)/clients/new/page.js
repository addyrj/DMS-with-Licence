'use client';
// src/app/(superadmin)/clients/new/page.js
import { useState }           from 'react';
import { useRouter }           from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient }        from '../../../../lib/api';
import { useToast }            from '../../../../components/ui/Toast';
import Card                    from '../../../../components/ui/Card';
import Button                  from '../../../../components/ui/Button';
import { Field, Input, Select } from '../../../../components/ui/Input';
import Toggle                  from '../../../../components/ui/Toggle';
import { ArrowLeft }           from 'lucide-react';
import Link                    from 'next/link';

const PERMS = [
  { key:'perm_delete_content',   label:'Delete / Add Content' },
  { key:'perm_create_lines',     label:'Create Production Lines' },
  { key:'perm_assign_displays',  label:'Assign Displays' },
  { key:'perm_upload_files',     label:'Upload / Delete Files' },
  { key:'perm_create_users',     label:'Create User IDs' },
];

export default function NewClientPage() {
  const router = useRouter();
  const toast  = useToast();
  const qc     = useQueryClient();

  const [form, setForm] = useState({
    company_name:'', admin_username:'', admin_password:'', admin_email:'',
    contact_phone:'', requirement:'normal',
    devices_required: 1,
    subscription_days: 365,
  });

  // Custom pricing — SA types their own price per GB
  const [pricePerGb, setPricePerGb] = useState('');

  const [perms, setPerms] = useState({
    perm_delete_content:true, perm_create_lines:true,
    perm_assign_displays:true, perm_upload_files:true, perm_create_users:true,
  });
  const [errors, setErrors] = useState({});

  const devices        = Number(form.devices_required) || 0;
  // Storage = 1 GB per display, read only
  const totalStorage   = devices;
  // Price = SA's custom price per GB × total storage GB
  const pricePerGbNum  = Number(pricePerGb) || 0;
  const autoPrice      = pricePerGbNum * totalStorage;

  const mut = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['clients'] });
      toast('Client created!');
      router.push('/clients');
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.company_name.trim())      e.company_name   = 'Required';
    if (form.admin_username.length < 3) e.admin_username = 'Min 3 characters';
    if (form.admin_password.length < 8) e.admin_password = 'Min 8 characters';
    if (devices < 1)                    e.devices_required = 'Min 1 display';
    if (!pricePerGbNum || pricePerGbNum <= 0) e.price = 'Enter price per GB';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    mut.mutate({
      ...form,
      pricing:           autoPrice,
      devices_required:  devices,
      total_storage_gb:  totalStorage,
      subscription_days: Number(form.subscription_days),
      permissions:       perms,
    });
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Link href="/clients"><Button variant="ghost" size="sm"><ArrowLeft size={16}/></Button></Link>
          <div>
            <h2>Create New Client</h2>
            <p>Set up a new client company with their admin account</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Company Info */}
          <Card title="Company Information">
            <div className="form-grid form-grid--2">
              <Field label="Company Name *" error={errors.company_name}>
                <Input placeholder="e.g. ABC Manufacturing"
                  value={form.company_name} onChange={set('company_name')} error={errors.company_name}/>
              </Field>
              <Field label="Contact Phone">
                <Input placeholder="+91 98765 43210"
                  value={form.contact_phone} onChange={set('contact_phone')}/>
              </Field>
              <Field label="Requirement">
                <Select value={form.requirement} onChange={set('requirement')}>
                  <option value="normal">Normal Dashboard</option>
                  <option value="custom">Custom Dashboard</option>
                </Select>
              </Field>
              <Field label="Admin Email">
                <Input type="email" placeholder="admin@company.com"
                  value={form.admin_email} onChange={set('admin_email')}/>
              </Field>
            </div>
          </Card>

          {/* Admin Credentials */}
          <Card title="Admin Login Credentials">
            <div className="form-grid form-grid--2">
              <Field label="Admin Username *" error={errors.admin_username}>
                <Input placeholder="e.g. admin_abc"
                  value={form.admin_username} onChange={set('admin_username')} error={errors.admin_username}/>
              </Field>
              <Field label="Admin Password *" error={errors.admin_password}>
                <Input type="password" placeholder="Min 8 characters"
                  value={form.admin_password} onChange={set('admin_password')} error={errors.admin_password}/>
              </Field>
            </div>
          </Card>

          {/* Storage & Devices */}
          <Card title="Storage & Devices">
            <div className="form-grid form-grid--2">

              {/* Number of displays */}
              <Field label="Number of Displays *" hint="1 GB storage auto-assigned per display" error={errors.devices_required}>
                <Input type="number" min={1} max={500}
                  value={form.devices_required}
                  onChange={e => setForm(f => ({ ...f, devices_required: e.target.value }))}
                  error={errors.devices_required}/>
              </Field>

              {/* Total storage — READ ONLY, auto = 1 GB per display */}
              <Field label="Total Storage (GB)" hint="Auto-set: 1 GB per display — read only">
                <div style={{
                  padding:'10px 14px',
                  background:'var(--bg-main)',
                  borderRadius:'var(--radius-sm)',
                  border:'1px solid var(--border)',
                  fontSize:15, fontWeight:700,
                  color:'var(--text-heading)',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                  <span>{totalStorage} GB</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:400 }}>
                    {devices} display{devices !== 1 ? 's' : ''} × 1 GB
                  </span>
                </div>
              </Field>

              {/* Custom price per GB */}
              <Field label="Price per GB / month (₹) *"
                hint="SA sets custom price — e.g. ₹200 for 2 GB = ₹400/month"
                error={errors.price}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16, color:'var(--text-muted)', fontWeight:600 }}>₹</span>
                  <Input
                    type="number" min={1} placeholder="e.g. 200"
                    value={pricePerGb}
                    onChange={e => setPricePerGb(e.target.value)}
                    error={errors.price}
                    style={{ flex:1 }}/>
                  <span style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>/ GB / month</span>
                </div>
                {/* Quick price presets */}
                <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                  {[100, 150, 200, 250, 300, 500].map(v => (
                    <button key={v} type="button"
                      onClick={() => setPricePerGb(String(v))}
                      style={{
                        padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
                        border:'1px solid var(--border)',
                        background: pricePerGb === String(v) ? 'var(--primary)' : 'white',
                        color:      pricePerGb === String(v) ? 'white' : 'var(--text-body)',
                      }}>
                      ₹{v}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Subscription plan */}
              <Field label="Subscription Plan">
                <Select value={form.subscription_days} onChange={set('subscription_days')}>
                  <option value="30">Monthly (30 days)</option>
                  <option value="90">Quarterly (90 days)</option>
                  <option value="180">Half-Yearly (180 days)</option>
                  <option value="365">Yearly (365 days)</option>
                </Select>
              </Field>

              {/* Live pricing breakdown — full width */}
              {pricePerGbNum > 0 && devices > 0 && (
                <div style={{ gridColumn:'1/-1', background:'var(--primary-10)', padding:'16px 18px', borderRadius:'var(--radius-md)', border:'1px solid var(--primary)' }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--primary)', marginBottom:12 }}>
                    💰 Monthly Pricing Breakdown
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'var(--text-body)' }}>
                        {totalStorage} GB × ₹{pricePerGbNum}/GB
                      </span>
                      <span style={{ fontWeight:700 }}>₹{autoPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', color:'var(--text-muted)', fontSize:12 }}>
                      <span>{devices} display{devices!==1?'s':''} → {totalStorage} GB storage</span>
                    </div>
                    <div style={{
                      borderTop:'1px solid var(--primary)', paddingTop:10, marginTop:4,
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                    }}>
                      <span style={{ fontWeight:800, fontSize:16, color:'var(--primary)' }}>Total / month</span>
                      <span style={{ fontWeight:800, fontSize:22, color:'var(--primary)' }}>
                        ₹{autoPrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Permissions */}
          <Card title="Permissions" subtitle="What this client admin can do">
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {PERMS.map(({ key, label }) => (
                <Toggle key={key} checked={perms[key]}
                  onChange={v => setPerms(p => ({...p,[key]:v}))} label={label}/>
              ))}
            </div>
          </Card>

          <div style={{ display:'flex', gap:12, justifyContent:'flex-end', paddingBottom:40 }}>
            <Link href="/clients"><Button variant="secondary">Cancel</Button></Link>
            <Button variant="primary" type="submit" loading={mut.isPending}>
              {autoPrice > 0
                ? `Create Client — ₹${autoPrice.toLocaleString('en-IN')}/mo`
                : 'Create Client'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
