// src/components/ui/Avatar.js
import { initials } from '../../lib/utils';
export default function Avatar({ name='?', size='md', src }) {
  if (src) return <img src={src} alt={name} className={`avatar avatar--${size}`} style={{objectFit:'cover'}} />;
  return <div className={`avatar avatar--${size}`}>{initials(name)}</div>;
}
