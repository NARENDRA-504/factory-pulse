import React from 'react';

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
  const circumference = 2 * Math.PI * 34;
  let offset = 0;

  return <section className={panel} aria-label={title}>
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    <p className={muted}>{description}</p>
    {total ? <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${title}: ${safeSlices.map((s) => `${s.label} ${number(s.value)}`).join(', ')}`}>
          <circle cx="50" cy="50" r="34" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          {safeSlices.map((slice) => {
            const length = slice.value / total * circumference;
            const currentOffset = offset;
            offset += length;
            return <circle key={slice.label} cx="50" cy="50" r="34" fill="none" stroke={slice.color} strokeWidth="12" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><strong className="text-xl tabular-nums text-slate-900">{centerValue || number(total)}</strong><span className="max-w-[5rem] text-[10px] leading-tight text-slate-500">{centerLabel}</span></div>
      </div>
      <ul className="grid w-full gap-2 text-xs sm:max-w-[14rem]">
        {slices.map((slice) => <li key={slice.label} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2 text-slate-700"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />{slice.label}</span><strong className="tabular-nums text-slate-900">{number(slice.value)}</strong></li>)}
      </ul>
    </div> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">No saved values are available for this chart yet.</div>}
  </section>;
}

export function ComparisonBars({ title, description, rows, actualLabel = 'Actual', targetLabel = 'Target' }: {
  title: string; description: string; rows: ComparisonRow[]; actualLabel?: string; targetLabel?: string;
}) {
  const validRows = rows.filter((row) => Number.isFinite(row.actual) && Number.isFinite(row.target));
  const max = Math.max(1, ...validRows.flatMap((row) => [row.actual, row.target]));
  return <section className={panel} aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p></div><div className="flex gap-3 pt-1 text-[10px] text-slate-600"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-teal-600" />{actualLabel}</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sky-300" />{targetLabel}</span></div></div>
    {validRows.length ? <div className="mt-4 space-y-3">{validRows.map((row) => <div key={row.label}>
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px]"><span className="min-w-0 truncate font-medium text-slate-700">{row.label}</span><span className="shrink-0 tabular-nums text-slate-600">{number(row.actual)} / {number(row.target)}</span></div>
      <div className="space-y-1"><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, row.actual / max * 100))}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.max(0, Math.min(100, row.target / max * 100))}%` }} /></div></div>
    </div>)}</div> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Waiting for saved Simulator production counters.</div>}
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
  return <section className={panel} aria-label={title}>
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p>
    {visible.length ? <div className="mt-4 space-y-3">{visible.map((row) => <div key={row.label}>
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px]"><span className="min-w-0 truncate font-medium text-slate-700">{row.label}</span><strong className="shrink-0 tabular-nums text-slate-800">{number(row.value)}{row.unit ? ` ${row.unit}` : ''}</strong></div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 w-full opacity-40" style={{ backgroundImage: 'linear-gradient(to right, #cbd5e1 1px, transparent 1px)', backgroundSize: '25% 100%' }} /><div className="relative h-full rounded-full transition-all" style={{ width: `${Math.max(row.value > 0 ? 1 : 0, row.value / max * 100)}%`, backgroundColor: row.color || color }} /></div>
    </div>)}</div> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">No saved records are available for this comparison yet.</div>}
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
    x: points.length < 2 ? 50 : 8 + index / (points.length - 1) * 84,
    y: 84 - (row.value - (low - spread * 0.12)) / (spread * 1.24) * 68,
  }));
  const path = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const latest = points[points.length - 1];
  return <section className={panel} aria-label={title}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p></div>{latest && <div className="text-right"><strong className="text-sm tabular-nums text-slate-900">{number(latest.value)} {unit}</strong><div className="text-[10px] text-slate-500">Latest saved sample</div></div>}</div>
    {chartPoints.length >= 2 ? <><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-36 w-full overflow-visible" role="img" aria-label={`${title}: ${points.length} saved points, from ${number(low)} to ${number(high)} ${unit}`}>
      {[16, 38, 60, 82].map((y) => <line key={y} x1="8" x2="92" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />)}
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {chartPoints.map((point, index) => index === chartPoints.length - 1 || index === 0 ? <circle key={`${point.timestamp}-${index}`} cx={point.x} cy={point.y} r="1.7" fill={color} /> : null)}
    </svg><div className="flex justify-between text-[10px] text-slate-500"><span>{new Date(points[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>{points.length} stored readings · {unit}</span><span>{new Date(latest!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></> : <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-600">{points.length ? `Only one saved ${unit} reading is available. A trend needs at least two real samples.` : 'No saved history for this sensor yet. The current reading is shown above; no sample history is invented.'}</div>}
  </section>;
}

/** Side-by-side real bars, useful for good/scrap snapshots without implying a time trend. */
export function SplitBars({ title, description, rows, firstLabel, secondLabel, firstColor = '#0f9f78', secondColor = '#ed7a39' }: {
  title: string; description: string; rows: Array<{ label: string; first: number; second: number }>; firstLabel: string; secondLabel: string; firstColor?: string; secondColor?: string;
}) {
  const valid = rows.filter((row) => Number.isFinite(row.first) && Number.isFinite(row.second)).slice(0, 8);
  const max = Math.max(1, ...valid.flatMap((row) => [row.first, row.second]));
  return <section className={panel} aria-label={title}><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className={muted}>{description}</p></div><div className="flex gap-3 pt-1 text-[10px] text-slate-600"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: firstColor }} />{firstLabel}</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: secondColor }} />{secondLabel}</span></div></div>
  {valid.length ? <div className="mt-4 space-y-3">{valid.map((row) => <div key={row.label}><div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="truncate font-medium text-slate-700">{row.label}</span><span className="shrink-0 tabular-nums text-slate-600">{number(row.first)} · {number(row.second)}</span></div><div className="space-y-1"><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(row.first > 0 ? 1 : 0, row.first / max * 100)}%`, backgroundColor: firstColor }} /></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(row.second > 0 ? 1 : 0, row.second / max * 100)}%`, backgroundColor: secondColor }} /></div></div></div>)}</div> : <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Waiting for saved Simulator part counters.</div>}</section>;
}
