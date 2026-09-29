// src/components/ui/Button.js
import { Spinner } from './Spinner';
export default function Button({ children, variant='primary', size='', loading, className='', ...props }) {
  return (
    <button
      className={`btn btn--${variant}${size?` btn--${size}`:''} ${loading?'btn--loading':''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner size="sm" white={variant==='primary'} /> : null}
      {children}
    </button>
  );
}
