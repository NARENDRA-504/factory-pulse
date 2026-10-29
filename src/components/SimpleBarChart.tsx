import React from 'react';

export interface ChartDatum { label: string; value: number; color?: string; detail?: string }

/** Small, labeled SVG comparison chart for operational counts and current snapshots. */
export const SimpleBarChart: React.FC<{ data: ChartDatum[]; unit?: string; emptyText?: string }> = ({ data, unit = '', emptyText = 'No records available.' }) => {
  const rows = data.filter((row) => Number.isFinite(row.value));
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-500">{emptyText}</div>;
  const height = Math.max(150, rows.length * 40 + 16);
  return <div className="w-full overflow-x-auto"><svg role="img" aria-label="Horizontal bar chart" viewBox={`0 0 640 ${height}`} className="h-auto min-h-40 w-full" preserveAspectRatio="xMinYMin meet">
    {rows.map((row, index) => { const y = index * 40 + 5; const barWidth = Math.max(row.value > 0 ? 2 : 0, row.value / max * 390); return <g key={`${row.label}-${index}`}>
      <text x="0" y={y + 17} fill="#475569" fontSize="12">{row.label.length > 26 ? `${row.label.slice(0, 24)}…` : row.label}</text>
      <rect x="190" y={y + 3} width="400" height="18" rx="5" fill="#e2e8f0" />
      <rect x="190" y={y + 3} width={barWidth} height="18" rx="5" fill={row.color || '#14b8a6'} />
      <text x={Math.min(610, 198 + barWidth)} y={y + 17} fill="#0f172a" fontSize="12" fontWeight="600">{row.value.toLocaleString()}{unit ? ` ${unit}` : ''}</text>
      {row.detail && <text x="190" y={y + 34} fill="#64748b" fontSize="10">{row.detail}</text>}
    </g>; })}
  </svg></div>;
};
