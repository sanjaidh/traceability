import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  alertCount?: number;
  onClick?: () => void;
  active?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  alertCount,
  onClick,
  active = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`scada-panel p-3 relative cursor-pointer select-none transition-colors ${
        active ? 'border-[#F2A900] bg-[#22262C]' : 'hover:bg-[#22262C]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA0A8]">
          {title}
        </span>
        {Icon && <Icon className="w-4 h-4 text-[#9AA0A8]" />}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-bold font-mono text-[#E7E9EC] tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {alertCount !== undefined && alertCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-mono bg-[#D9473F]/20 text-[#D9473F] border border-[#D9473F]/40 alarm-pulsing">
            {alertCount} ALERT
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-1 text-[11px] text-[#9AA0A8] font-mono">
          {subtitle}
        </div>
      )}
    </div>
  );
};
