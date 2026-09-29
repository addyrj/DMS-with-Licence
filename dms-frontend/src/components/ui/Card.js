// src/components/ui/Card.js
export default function Card({ children, title, subtitle, action, flat, style, className='' }) {
  return (
    <div className={`card${flat?' card--flat':''} ${className}`} style={style}>
      {(title || action) && (
        <div className="card__header">
          <div>
            {title && <div className="card__title">{title}</div>}
            {subtitle && <div className="card__subtitle">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
