// src/components/ui/ConfirmModal.js
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';
export default function ConfirmModal({ open, onClose, onConfirm, title='Are you sure?', message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>Delete</Button>
      </>}
    >
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'8px 0 0',textAlign:'center'}}>
        <div style={{width:52,height:52,borderRadius:'50%',background:'var(--danger-10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <AlertTriangle size={24} color="var(--danger)" />
        </div>
        <p style={{color:'var(--text-body)',fontSize:14,lineHeight:1.6}}>{message||'This action cannot be undone.'}</p>
      </div>
    </Modal>
  );
}
