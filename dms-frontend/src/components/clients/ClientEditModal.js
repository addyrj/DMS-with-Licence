// src/components/clients/ClientEditModal.js
// FIX: added subscription_start date field for emergency corrections
'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateClient } from '../../lib/api';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Input';

const RATE_PER_GB = 200;

export default function ClientEditModal({ client, open, onClose, onSaved }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const [form, setForm] = useState({
    company_name: '', admin_email: '', contact_phone: '', requirement: 'normal',
    devices_required: 0, total_storage_gb: 0,
    subscription_start: '', subscription_end: '',
    overridePrice: false, pricing: 0,
  });

  useEffect(() => {
    if (client && open) {
      setForm({
        company_name:       client.company_name       || '',
        admin_email:        client.admin_email        || '',
        contact_phone:      client.contact_phone      || '',
        requirement:        client.requirement        || 'normal',
        devices_required:   client.devices_required   ?? 0,
        total_storage_gb:   client.total_storage_gb   ?? 0,
        subscription_start: client.subscription_start
          ? String(client.subscription_start).slice(0, 10) : '',
        subscription_end:   client.subscription_end
          ? String(client.subscription_end).slice(0, 10) : '',
        overridePrice: false,
        pricing:       client.pricing ?? 0,
      });
    }
  }, [client, open]);

  const devices   = Number(form.devices_required) || 0;
  const storage   = Math.max(devices, Number(form.total_storage_gb) || devices);
  const autoPrice = storage * RATE_PER_GB;
  const oldPrice  = Number(client?.pricing || 0);
  const finalPrice = form.overridePrice ? (Number(form.pricing) || 0) : autoPrice;

  const mut = useMutation({
    mutationFn: (body) => updateClient(client.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', String(client.id)] });
      toast('Client updated!');
      onClose();
      onSaved?.();
    },
    onError: (e) => toast(e.message, 'danger'),
  });

  const handleSave = () => {
    mut.mutate({
      company_name:       form.company_name,
      admin_email:        form.admin_email,
      contact_phone:      form.contact_phone,
      requirement:        form.requirement,
      devices_required:   devices,
      total_storage_gb:   storage,
      pricing:            form.overridePrice ? Number(form.pricing) : autoPrice,
      subscription_start: form.subscription_start || undefined,
      subscription_end:   form.subscription_end   || undefined,
    });
  };

  if (!client) return null;

  return (
    <Modal open={open} onClose={onClose}
      title={`Edit Client — ${client.company_name}`} size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={mut.isPending} onClick={handleSave}>Save Changes</Button>
      </>}>
      <div className="form-grid form-grid--2">

        <Field label="Company Name">
          <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
        </Field>
        <Field label="Admin Email">
          <Input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} />
        </Field>
        <Field label="Contact Phone">
          <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
        </Field>
        <Field label="Requirement">
          <Select value={form.requirement} onChange={e => setForm(f => ({ ...f, requirement: e.target.value }))}>
            <option value="normal">Normal Dashboard</option>
            <option value="custom">Custom Dashboard</option>
          </Select>
        </Field>

        <Field label="Displays Allocated" hint="Auto-adjusts storage & price">
          <Input type="number" min={1} value={form.devices_required}
            onChange={e => {
              const n = Number(e.target.value) || 1;
              setForm(f => ({
                ...f,
                devices_required: e.target.value,
                total_storage_gb: Math.max(Number(f.total_storage_gb) || 0, n),
              }));
            }} />
        </Field>
        <Field label="Total Storage (GB)" hint="Must be ≥ displays allocated">
          <Input type="number" min={devices} value={form.total_storage_gb}
            onChange={e => setForm(f => ({ ...f, total_storage_gb: e.target.value }))} />
        </Field>

        {/* FIX: subscription START date editable for emergency corrections */}
        <Field label="Subscription Start Date" hint="Emergency correction only">
          <Input type="date" value={form.subscription_start}
            onChange={e => setForm(f => ({ ...f, subscription_start: e.target.value }))} />
        </Field>
        <Field label="Subscription End Date" hint="Direct edit — no log entry">
          <Input type="date" value={form.subscription_end}
            onChange={e => setForm(f => ({ ...f, subscription_end: e.target.value }))} />
        </Field>

        <Field label="Monthly Price (₹)" hint="Auto-calculated unless overridden">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Input type="number" min={0} disabled={!form.overridePrice}
              value={form.overridePrice ? form.pricing : finalPrice}
              onChange={e => setForm(f => ({ ...f, pricing: e.target.value }))}
              style={{ flex:1, opacity: form.overridePrice ? 1 : 0.6 }} />
            <button type="button"
              onClick={() => setForm(f => ({ ...f, overridePrice: !f.overridePrice, pricing: f.overridePrice ? f.pricing : autoPrice }))}
              style={{ fontSize:12, fontWeight:700, padding:'8px 12px', borderRadius:'var(--radius-sm)',
                border:'1px solid var(--border)', cursor:'pointer',
                background: form.overridePrice ? 'var(--primary)' : 'white',
                color:      form.overridePrice ? 'white' : 'var(--text-body)', whiteSpace:'nowrap' }}>
              {form.overridePrice ? 'Custom ✓' : 'Override'}
            </button>
          </div>
        </Field>

        {/* Pricing preview */}
        <div style={{ gridColumn:'1/-1', background:'var(--primary-10)', borderRadius:'var(--radius-sm)', padding:'12px 14px', fontSize:13 }}>
          <div style={{ fontWeight:700, color:'var(--primary)', marginBottom:8 }}>💰 Pricing — ₹{RATE_PER_GB}/GB flat</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span>{storage} GB × ₹{RATE_PER_GB}</span>
              <span style={{ fontWeight:600 }}>₹{autoPrice.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ borderTop:'1px solid var(--primary)', paddingTop:6, display:'flex', justifyContent:'space-between', fontWeight:800,
              color: form.overridePrice ? 'var(--warning)' : 'var(--primary)' }}>
              <span>{form.overridePrice ? 'Custom / month' : 'Total / month'}</span>
              <span>₹{finalPrice.toLocaleString('en-IN')}</span>
            </div>
            {finalPrice !== oldPrice && (
              <div style={{ fontSize:12, color: finalPrice > oldPrice ? 'var(--warning)' : 'var(--success)', marginTop:4 }}>
                {finalPrice > oldPrice ? '▲' : '▼'} Was ₹{oldPrice.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
