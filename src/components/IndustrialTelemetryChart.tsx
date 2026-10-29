import React, { useState } from 'react';
import { DataProvenance } from '../types';
import { ProvenanceBadge } from './ProvenanceBadge';

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  provenance?: DataProvenance;
}

interface IndustrialTelemetryChartProps {
  title: string;
  subtitle?: string;
  unit: string;
  data: ChartDataPoint[];
  provisionalBaseline?: number;
  baselineLabel?: string;
  color?: 'cyan' | 'amber' | 'emerald' | 'purple' | 'rose' | 'teal';
  provenance?: DataProvenance;
  height?: number;
  minY?: number;
  maxY?: number;
}

export const IndustrialTelemetryChart: React.FC<IndustrialTelemetryChartProps> = ({
  title,
  subtitle,
  unit,
  data,
  provisionalBaseline,
  baselineLabel = 'Provisional Statistical Baseline',
  color = 'cyan',
  provenance = 'EMPIRICAL DATASET',
  height = 200,
  minY: customMinY,
  maxY: customMaxY,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center min-h-[200px] text-slate-500 font-mono text-xs">
        <span>No telemetry data available for active time window</span>
      </div>
    );
  }

  // Calculate scales
  const rawValues = data.map((d) => d.y);
  if (provisionalBaseline !== undefined) {
    rawValues.push(provisionalBaseline);
  }
  const computedMinY = Math.min(...rawValues);
  const computedMaxY = Math.max(...rawValues);
  const minY = customMinY !== undefined ? customMinY : Math.max(0, computedMinY * 0.85);
  const maxY = customMaxY !== undefined ? customMaxY : computedMaxY * 1.15 || 10;
  const rangeY = maxY - minY || 1;

  // Chart dimensions inside SVG viewBox
  const svgWidth = 600;
  const svgHeight = height;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const points = data.map((d, index) => {
    const xRatio = data.length > 1 ? index / (data.length - 1) : 0.5;
    const x = paddingLeft + xRatio * plotWidth;
    const yRatio = (d.y - minY) / rangeY;
    const y = paddingTop + plotHeight - yRatio * plotHeight;
    return { x, y, raw: d };
  });

  // Color mapping
  const colorMap = {
    teal: { stroke: '#2dd4bf', fill: '#0d9488', glow: 'rgba(45, 212, 191, 0.4)' },
    cyan: { stroke: '#38bdf8', fill: '#0284c7', glow: 'rgba(56, 189, 248, 0.4)' },
    amber: { stroke: '#fbbf24', fill: '#d97706', glow: 'rgba(251, 191, 36, 0.4)' },
    emerald: { stroke: '#34d399', fill: '#059669', glow: 'rgba(52, 211, 153, 0.4)' },
    purple: { stroke: '#c084fc', fill: '#9333ea', glow: 'rgba(192, 132, 252, 0.4)' },
    rose: { stroke: '#fb7185', fill: '#e11d48', glow: 'rgba(251, 113, 133, 0.4)' },
  };
  const theme = colorMap[color] || colorMap.cyan;

  // Path generator
  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`
      : '';

  // Baseline Y position
  const baselineY =
    provisionalBaseline !== undefined
      ? paddingTop + plotHeight - ((provisionalBaseline - minY) / rangeY) * plotHeight
      : null;

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  const safeGradientId = `grad-${(title || 'telemetry-chart').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-4 relative shadow-xs flex flex-col justify-between">
      {/* Chart Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-xs sm:text-sm text-slate-900 tracking-tight">{title || 'Telemetry Stream'}</h3>
            <span className="text-[10px] font-mono text-cyan-700 font-bold">[{unit || 'units'}]</span>
          </div>
          {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {provisionalBaseline !== undefined && (
            <span className="hidden sm:inline-flex text-[9px] font-mono text-amber-700/90 bg-amber-50 border border-slate-200 px-1.5 py-0.5 rounded">
              P95 Baseline: {provisionalBaseline} {unit}
            </span>
          )}
          <ProvenanceBadge provenance={provenance} size="sm" />
        </div>
      </div>

      {/* SVG Container with Interactive Crosshair */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={safeGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={theme.fill} stopOpacity="0.35" />
              <stop offset="100%" stopColor={theme.fill} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + plotHeight * ratio;
            const val = maxY - ratio * rangeY;
            return (
              <g key={ratio}>
                <line x1={paddingLeft} y1={y} x2={svgWidth - paddingRight} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                <text x={paddingLeft - 6} y={y + 3.5} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="ui-monospace, monospace">
                  {val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Provisional Statistical Baseline Line */}
          {baselineY !== null && baselineY >= paddingTop && baselineY <= paddingTop + plotHeight && (
            <g>
              <line
                x1={paddingLeft}
                y1={baselineY}
                x2={svgWidth - paddingRight}
                y2={baselineY}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text
                x={svgWidth - paddingRight - 4}
                y={baselineY - 4}
                textAnchor="end"
                fill="#fbbf24"
                fontSize="8.5"
                fontFamily="ui-monospace, monospace"
                fontWeight="bold"
              >
                {baselineLabel} ({provisionalBaseline} {unit})
              </text>
            </g>
          )}

          {/* Area Fill */}
          {areaD && <path d={areaD} fill={`url(#${safeGradientId})`} />}

          {/* Primary Trend Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={theme.stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 4px ${theme.glow})` }}
            />
          )}

          {/* Hover interactive vertical line and points */}
          {points.map((p, idx) => (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(idx)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoverIndex === idx ? 5 : 2.5}
                fill={hoverIndex === idx ? '#ffffff' : theme.stroke}
                stroke="#ffffff"
                strokeWidth="1.5"
                className="transition-all"
              />
              {/* Invisible wider target for touch/hover */}
              <rect
                x={p.x - plotWidth / (points.length * 2)}
                y={paddingTop}
                width={plotWidth / points.length}
                height={plotHeight}
                fill="transparent"
              />
            </g>
          ))}

          {/* Active Hover Crosshair */}
          {activePoint && (
            <g pointerEvents="none">
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={paddingTop + plotHeight}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={6}
                fill={theme.stroke}
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Bottom X-Axis line */}
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={svgWidth - paddingRight} y2={paddingTop + plotHeight} stroke="#94a3b8" strokeWidth="1" />

          {/* X-Axis labels (First, Middle, Last) */}
          {points.length > 0 && (
            <g fill="#64748b" fontSize="9" fontFamily="ui-monospace, monospace">
              <text x={points[0].x} y={svgHeight - 10} textAnchor="start">
                {String(points[0].raw.x)}
              </text>
              {points.length > 2 && (
                <text x={points[Math.floor(points.length / 2)].x} y={svgHeight - 10} textAnchor="middle">
                  {String(points[Math.floor(points.length / 2)].raw.x)}
                </text>
              )}
              <text x={points[points.length - 1].x} y={svgHeight - 10} textAnchor="end">
                {String(points[points.length - 1].raw.x)}
              </text>
            </g>
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-xl text-left text-xs font-mono text-slate-800"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${Math.max(10, (activePoint.y / svgHeight) * 100 - 30)}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="text-[10px] text-slate-600">{String(activePoint.raw.x)}</div>
            <div className="font-bold text-slate-900 text-sm">
              {activePoint.raw.y.toFixed(2)} <span className="text-cyan-700 text-xs font-normal">{unit}</span>
            </div>
            {activePoint.raw.label && (
              <div className="text-[10px] text-slate-600 mt-0.5">{activePoint.raw.label}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
