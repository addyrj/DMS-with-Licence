// src/components/ui/StatCard.js
import { TrendingUp, TrendingDown } from 'lucide-react';
export default function StatCard({ icon: Icon, label, value, change, changeType='up', color='primary' }) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${color}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="stat-card__info">
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">{value ?? '—'}</div>
        {change != null && (
          <div className={`stat-card__change stat-card__change--${changeType}`}>
            {changeType === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {change}
          </div>
        )}
      </div>
    </div>
  );
}
