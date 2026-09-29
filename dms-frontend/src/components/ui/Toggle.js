// src/components/ui/Toggle.js
export default function Toggle({ checked, onChange, label }) {
  return (
    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
      <span className="toggle">
        <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} />
        <span className="toggle__track" />
        <span className="toggle__thumb" />
      </span>
      {label && <span style={{fontSize:14,color:'var(--text-body)'}}>{label}</span>}
    </label>
  );
}
