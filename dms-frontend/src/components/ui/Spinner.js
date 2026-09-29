// src/components/ui/Spinner.js
export function Spinner({ size='', white }) {
  return <div className={`spinner${size?` spinner--${size}`:''}${white?' spinner--white':''}`} />;
}
