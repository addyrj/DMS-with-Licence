// src/components/ui/Input.js
'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function Field({ label, hint, error, children }) {
  return (
    <div className="field">
      {label && <label className="field__label">{label}</label>}
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}

export function Input({ error, type, style, ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div style={{ position:'relative', width:'100%' }}>
      <input
        type={isPassword ? (show ? 'text' : 'password') : type}
        className={`input${error ? ' input--error' : ''}`}
        style={{ ...style, paddingRight: isPassword ? 44 : undefined }}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(v => !v)}
          style={{
            position:'absolute', right:12, top:'50%',
            transform:'translateY(-50%)',
            background:'none', border:'none', cursor:'pointer',
            color:'var(--text-muted)', display:'flex',
            alignItems:'center', padding:4,
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  );
}

export function Select({ error, children, ...props }) {
  return (
    <select className={`input${error ? ' input--error' : ''}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ error, ...props }) {
  return <textarea className={`input${error ? ' input--error' : ''}`} {...props} />;
}