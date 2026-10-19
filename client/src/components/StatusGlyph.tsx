import React from 'react';

export type MachineStatusType = 'RUNNING' | 'IDLE' | 'SETUP' | 'ALARM' | 'WAITING' | 'OFFLINE';

interface StatusGlyphProps {
  status: string | MachineStatusType;
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export const StatusGlyph: React.FC<StatusGlyphProps> = ({
  status,
  showLabel = false,
  size = 12,
  className = '',
}) => {
  const norm = (status || '').toUpperCase();

  let color = 'var(--status-offline)';
  let label = 'Offline';
  let symbol = '✕';
  let shape: React.ReactNode = null;

  switch (norm) {
    case 'RUNNING':
      color = 'var(--status-running)';
      label = 'Running';
      symbol = '■';
      shape = (
        <rect x="1" y="1" width="10" height="10" rx="1" fill={color} />
      );
      break;

    case 'IDLE':
      color = 'var(--status-idle)';
      label = 'Idle';
      symbol = '□';
      shape = (
        <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke={color} strokeWidth="1.8" />
      );
      break;

    case 'SETUP':
      color = 'var(--status-setup)';
      label = 'Setup';
      symbol = '◆';
      shape = (
        <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" fill={color} />
      );
      break;

    case 'ALARM':
    case 'BREAKDOWN':
      color = 'var(--status-alarm)';
      label = 'Alarm';
      symbol = '▲';
      shape = (
        <polygon points="6,0.5 11.5,11.5 0.5,11.5" fill={color} />
      );
      break;

    case 'WAITING':
    case 'STARVED':
      color = 'var(--status-waiting)';
      label = 'Waiting';
      symbol = '◩';
      shape = (
        <g>
          <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke={color} strokeWidth="1.8" />
          <path d="M 1.5 1.5 L 10.5 10.5 L 1.5 10.5 Z" fill={color} />
        </g>
      );
      break;

    default: // OFFLINE
      color = 'var(--status-offline)';
      label = 'Offline';
      symbol = '✕';
      shape = (
        <g stroke={color} strokeWidth="2" strokeLinecap="round">
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2" y2="10" />
        </g>
      );
      break;
  }

  return (
    <span 
      className={`inline-flex items-center gap-1.5 font-sans font-medium ${className}`}
      style={{ color: showLabel ? 'inherit' : color }}
      title={`${label} (${symbol})`}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 12 12" 
        className={norm === 'ALARM' ? 'alarm-pulsing flex-shrink-0' : 'flex-shrink-0'}
        aria-hidden="true"
      >
        {shape}
      </svg>
      {showLabel && (
        <span className="text-xs" style={{ color }}>
          {label}
        </span>
      )}
    </span>
  );
};
