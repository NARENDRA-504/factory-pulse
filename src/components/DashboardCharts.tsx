import React, { useId } from 'react';

export type ChartSlice = { label: string; value: number; color: string };
export type ComparisonRow = { label: string; actual: number; target: number };
export type RangeRow = { label: string; value: number; min: number; max: number; unit: string };
export type BarRow = { label: string; value: number; unit?: string; color?: string };
export type TrendPoint = { timestamp: string; value: number };

const panel = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
const muted = 'mt-1 text-[11px] leading-relaxed text-slate-600';
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function DonutChart({ title, description, slices, centerValue, centerLabel }: {
  title: string; description: string; slices: ChartSlice[]; centerValue: string; centerLabel: string;
}) {
  const safeSlices = slices.filter((slice) => Number.isFinite(slice.value) && slice.value > 0);
  const total = safeSlices.reduce((sum, slice) => sum + slice.value, 0);
  const circumference = 2 * Math.PI * 35;
  let offset = 0;

  return <section className={panel} aria-label={title}>
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    <p className={muted}>{description}</p>
    {total ? <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative h-36 w-36 shrink-0 rounded-full bg-gradient-to-br from-slate-50 to-white p-1">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 drop-shadow-sm" role="img" aria-label={`${title}: ${safeSlices.map((s) => `${s.label} ${number(s.value)}`).join(', ')}`}>
          <circle cx="50" cy="50" r="35" fill="none" stroke="#edf2f7" strokeWidth="13" />
          {safeSlices.map((slice) => {
            const length = slice.value / total * circumference;
            const currentOffset = offset;
            offset += length;
            return <circle key={slice.label} cx="50" cy="50" r="35" fill="none" stroke={slice.color} strokeWidth="13" strokeDasharray={`${Math.max(0, length - 1.5)} ${circumference - Math.max(0, length - 1.5)}`} strokeDashoffset={-currentOffset} strokeLinecap="round"><title>{slice.label}: {number(slice.value)}</title></circle>;
          })}
        </svg>
        <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner"><strong className="text-xl tabular-nums tracking-tight text-slate-900">{centerValue || number(total)}</strong><span className="max-w-[5rem] text-[10px] leading-tight text-slate-500">{centerLabel}</span></div>
      </div>
      <ul className="grid w-full gap-1.5 text-xs sm:max-w-[14rem]">
        {slices.map((slice) => <li key={slice.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"><span className="flex min-w-0 items-center gap-2 text-slate-700"><i className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: slice.color }} />{slice.label}</span><strong className="tabular-nums text-slate-900">{number(slice.value)}</strong></li>)}
      </ul>
    </div> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">No saved values are available for this chart yet.</div>}
  </section>;
}

export function ComparisonBars({ title, description, rows, actualLabel = 'Actual', targetLabel = 'Target' }: {
  title: string; description: string; rows: ComparisonRow[]; actualLabel?: string; targetLabel?: string;
}) {
  const validRows = rows.filter((row) => Number.isFinite(row.actual) && Number.isFinite(row.target));
  const max = Math.max(1, ...validRows.flatMap((row) => [row.actual, row.target]));
  const width = 420, left = 132, right = 42, plotWidth = width - left - right;
  const height = Math.max(112, validRows.length * 48 + 32);
  const tickStep = max / 4;
  return <section className={panel} aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p></div><div className="flex gap-3 pt-1 text-[10px] text-slate-600"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-teal-600" />{actualLabel}</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sky-300" />{targetLabel}</span></div></div>
    {validRows.length ? <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto max-h-[280px] w-full" role="img" aria-label={`${title}: ${validRows.map((r) => `${r.label}, ${actualLabel} ${number(r.actual)}, ${targetLabel} ${number(r.target)}`).join('; ')}`}>
      {[0, 1, 2, 3, 4].map((tick) => { const x = left + plotWidth * tick / 4; return <g key={tick}><line x1={x} x2={x} y1="12" y2={height - 23} stroke="#e8eef4" strokeDasharray="3 4" /><text x={x} y={height - 6} textAnchor="middle" fill="#64748b" fontSize="9">{number(tickStep * tick)}</text></g>; })}
      {validRows.map((row, index) => { const y = 20 + index * 48; const actualWidth = Math.max(row.actual > 0 ? 1 : 0, Math.max(0, row.actual) / max * plotWidth); const targetWidth = Math.max(row.target > 0 ? 1 : 0, Math.max(0, row.target) / max * plotWidth); return <g key={row.label}>
        <text x={left - 8} y={y + 15} textAnchor="end" fill="#334155" fontSize="10" fontWeight="500">{row.label.length > 19 ? `${row.label.slice(0, 18)}…` : row.label}<title>{row.label}</title></text>
        <rect x={left} y={y + 1} width={plotWidth} height="11" rx="5.5" fill="#f1f5f9" /><rect x={left} y={y + 1} width={actualWidth} height="11" rx="5.5" fill="#0f9f8f"><title>{actualLabel}: {number(row.actual)}</title></rect>
        <rect x={left} y={y + 17} width={plotWidth} height="8" rx="4" fill="#f1f5f9" /><rect x={left} y={y + 17} width={targetWidth} height="8" rx="4" fill="#8fc9ed"><title>{targetLabel}: {number(row.target)}</title></rect>
      </g>; })}
    </svg> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Waiting for production data.</div>}
  </section>;
}

export function RangeBars({ title, description, rows }: { title: string; description: string; rows: RangeRow[] }) {
  const validRows = rows.filter((row) => [row.value, row.min, row.max].every(Number.isFinite) && row.max > row.min);
  return <section className={panel} aria-label={title}>
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p>
    {validRows.length ? <div className="mt-4 space-y-3">{validRows.map((row) => {
      const position = (row.value - row.min) / (row.max - row.min) * 100;
      const outside = position < 0 || position > 100;
      return <div key={`${row.label}-${row.unit}`}>
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-medium text-slate-700">{row.label}</span><span className={`shrink-0 font-semibold tabular-nums ${outside ? 'text-rose-700' : 'text-slate-800'}`}>{number(row.value)} {row.unit}</span></div>
        <div className="relative h-3 rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-sky-100 via-emerald-100 to-amber-100" /><span className="absolute -top-0.5 h-4 w-1 rounded-full bg-slate-500" style={{ left: '0%' }} /><span className="absolute -top-0.5 h-4 w-1 rounded-full bg-slate-500" style={{ left: 'calc(100% - 4px)' }} /><span className={`absolute -top-1 h-5 w-3 -translate-x-1/2 rounded-full border-2 border-white shadow ${outside ? 'bg-rose-600' : 'bg-teal-700'}`} style={{ left: `${Math.max(0, Math.min(100, position))}%` }} /></div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{number(row.min)} {row.unit}</span><span>{number(row.max)} {row.unit}{outside ? ' · outside configured range' : ''}</span></div>
      </div>;
    })}</div> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">No sensor readings with configured ranges are available yet.</div>}
  </section>;
}

/** A compact, scaled horizontal bar chart for counts and cross-machine comparisons. */
export function HorizontalBarChart({ title, description, rows, color = '#1687b8', limit = 8 }: {
  title: string; description: string; rows: BarRow[]; color?: string; limit?: number;
}) {
  const visible = rows.filter((row) => Number.isFinite(row.value) && row.value >= 0).slice(0, limit);
  const max = Math.max(1, ...visible.map((row) => row.value));
  const width = 420, left = 132, right = 48, plotWidth = width - left - right;
  const height = Math.max(100, visible.length * 35 + 30);
  return <section className={panel} aria-label={title}>
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p>
    {visible.length ? <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-auto max-h-[300px] w-full" role="img" aria-label={`${title}: ${visible.map((r) => `${r.label} ${number(r.value)}${r.unit ? ` ${r.unit}` : ''}`).join('; ')}`}>
      {[0, 1, 2, 3, 4].map((tick) => { const x = left + plotWidth * tick / 4; return <g key={tick}><line x1={x} x2={x} y1="8" y2={height - 20} stroke="#e8eef4" strokeDasharray="3 4" /><text x={x} y={height - 5} textAnchor="middle" fill="#64748b" fontSize="9">{number(max * tick / 4)}</text></g>; })}
      {visible.map((row, index) => { const y = 12 + index * 35; const barWidth = Math.max(row.value > 0 ? 1 : 0, row.value / max * plotWidth); return <g key={row.label}>
        <text x={left - 8} y={y + 13} textAnchor="end" fill="#334155" fontSize="10" fontWeight="500">{row.label.length > 20 ? `${row.label.slice(0, 19)}…` : row.label}<title>{row.label}</title></text>
        <rect x={left} y={y} width={plotWidth} height="18" rx="6" fill="#f1f5f9" />
        <rect x={left} y={y} width={barWidth} height="18" rx="6" fill={row.color || color}><title>{row.label}: {number(row.value)}{row.unit ? ` ${row.unit}` : ''}</title></rect>
        <text x={Math.min(width - 2, left + barWidth + 5)} y={y + 13} fill="#334155" fontSize="10" fontWeight="600">{number(row.value)}{row.unit ? ` ${row.unit}` : ''}</text>
      </g>; })}
    </svg> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">No saved records are available for this comparison yet.</div>}
  </section>;
}

/** SVG trend built only from timestamped rows returned by the persistence API. */
export function SensorTrendChart({ title, description, rows, unit, color = '#138b84' }: {
  title: string; description: string; rows: TrendPoint[]; unit: string; color?: string;
}) {
  const points = [...rows].filter((row) => Number.isFinite(row.value) && Number.isFinite(Date.parse(row.timestamp))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(-60);
  const values = points.map((row) => row.value);
  const low = Math.min(...values), high = Math.max(...values);
  const spread = high - low || Math.max(Math.abs(high) * 0.08, 1);
  const chartPoints = points.map((row, index) => ({
    ...row,
    x: points.length < 2 ? 270 : 72 + index / (points.length - 1) * 396,
    y: 142 - (row.value - (low - spread * 0.12)) / (spread * 1.24) * 116,
  }));
  const path = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = chartPoints.length ? `${path} L ${chartPoints[chartPoints.length - 1].x} 150 L ${chartPoints[0].x} 150 Z` : '';
  const latest = points[points.length - 1];
  const gradientId = `trend-${useId().replace(/:/g, '')}`;
  const axisLow = low - spread * 0.12, axisHigh = high + spread * 0.12;
  return <section className={panel} aria-label={title}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p></div>{latest && <div className="text-right"><strong className="text-sm tabular-nums text-slate-900">{number(latest.value)} {unit}</strong><div className="text-[10px] text-slate-500">Latest saved sample</div></div>}</div>
    {chartPoints.length >= 2 ? <><div className="mt-3 rounded-xl bg-gradient-to-b from-slate-50/80 to-white p-2"><svg viewBox="0 0 480 180" className="h-44 w-full overflow-visible" role="img" aria-label={`${title}: ${points.length} recorded points, range ${number(low)} to ${number(high)} ${unit}`}>
      <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".24" /><stop offset="100%" stopColor={color} stopOpacity=".015" /></linearGradient></defs>
      {[24, 62, 100, 138].map((y, index) => { const value = axisHigh - (axisHigh - axisLow) * index / 3; return <g key={y}><line x1="72" x2="472" y1={y} y2={y} stroke="#dfe8ef" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" /><text x="65" y={y + 3.5} textAnchor="end" fill="#64748b" fontSize="10">{number(value)}</text></g>; })}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {chartPoints.map((point, index) => index === chartPoints.length - 1 || index === 0 ? <g key={`${point.timestamp}-${index}`}><circle cx={point.x} cy={point.y} r="2.6" fill="white" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"><title>{new Date(point.timestamp).toLocaleString()}: {number(point.value)} {unit}</title></circle></g> : <title key={`${point.timestamp}-${index}`}>{new Date(point.timestamp).toLocaleString()}: {number(point.value)} {unit}</title>)}
    </svg></div><div className="flex justify-between text-[10px] text-slate-500"><span>{new Date(points[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>{points.length} recorded samples · {unit}</span><span>{new Date(latest!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div></> : <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-600">{points.length ? `Only one recorded ${unit} value is available. A trend needs at least two recorded samples.` : 'No saved history for this sensor yet. The current value is shown above; no sample history is invented.'}</div>}
  </section>;
}

/** Side-by-side real bars, useful for good/scrap snapshots without implying a time trend. */
export function SplitBars({ title, description, rows, firstLabel, secondLabel, firstColor = '#0f9f78', secondColor = '#ed7a39' }: {
  title: string; description: string; rows: Array<{ label: string; first: number; second: number }>; firstLabel: string; secondLabel: string; firstColor?: string; secondColor?: string;
}) {
  const valid = rows.filter((row) => Number.isFinite(row.first) && Number.isFinite(row.second)).slice(0, 8);
  const max = Math.max(1, ...valid.flatMap((row) => [row.first, row.second]));
  const width = 480, height = 208, top = 18, bottom = 46, left = 34, right = 8;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const groupWidth = valid.length ? plotWidth / valid.length : plotWidth;
  const barWidth = Math.min(24, groupWidth * 0.28);
  return <section className={panel} aria-label={title}><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p></div><div className="flex gap-3 pt-1 text-[10px] text-slate-600"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: firstColor }} />{firstLabel}</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: secondColor }} />{secondLabel}</span></div></div>
  {valid.length ? <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={`${title}: ${valid.map((r) => `${r.label}, ${firstLabel} ${number(r.first)}, ${secondLabel} ${number(r.second)}`).join('; ')}`}>
    {[0, 1, 2, 3, 4].map((tick) => { const y = top + plotHeight * tick / 4; return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e8eef4" strokeDasharray="3 4" /><text x={left - 5} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9">{number(max * (4 - tick) / 4)}</text></g>; })}
    {valid.map((row, index) => { const cx = left + groupWidth * (index + .5); const firstHeight = Math.max(row.first > 0 ? 1 : 0, Math.max(0, row.first) / max * plotHeight); const secondHeight = Math.max(row.second > 0 ? 1 : 0, Math.max(0, row.second) / max * plotHeight); return <g key={row.label}>
      <rect x={cx - barWidth - 2} y={top + plotHeight - firstHeight} width={barWidth} height={firstHeight} rx="4" fill={firstColor}><title>{row.label} · {firstLabel}: {number(row.first)}</title></rect>
      <rect x={cx + 2} y={top + plotHeight - secondHeight} width={barWidth} height={secondHeight} rx="4" fill={secondColor}><title>{row.label} · {secondLabel}: {number(row.second)}</title></rect>
      <text x={cx} y={height - 25} textAnchor="middle" fill="#475569" fontSize="9">{row.label.length > 12 ? `${row.label.slice(0, 11)}…` : row.label}<title>{row.label}</title></text>
    </g>; })}
  </svg> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Waiting for part-count data.</div>}</section>;
}
