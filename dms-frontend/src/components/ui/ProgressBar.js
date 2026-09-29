// src/components/ui/ProgressBar.js
export default function ProgressBar({ value, max=100, size='md', variant }) {
  const pct = Math.min(100, Math.max(0, (value/max)*100));
  const auto = pct >= 80 ? 'danger' : pct >= 60 ? 'warning' : 'success';
  return (
    <div className={`progress progress--${size} progress--${variant||auto}`}>
      <div className="progress__bar" style={{width:`${pct}%`}} />
    </div>
  );
}
