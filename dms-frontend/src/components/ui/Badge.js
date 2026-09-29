// src/components/ui/Badge.js
export default function Badge({ children, variant='primary', dot }) {
  return (
    <span className={`badge badge--${variant}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
