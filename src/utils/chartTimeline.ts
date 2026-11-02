export function chartTimeline(rows: Array<{ timestamp: string; value: number }>) {
  const unique = new Map<number, { timestamp: string; value: number }>();
  for (const row of rows) {
    const time = Date.parse(row.timestamp);
    if (Number.isFinite(time) && Number.isFinite(row.value)) unique.set(time, row);
  }
  const points = [...unique.entries()].sort((a, b) => a[0] - b[0]).slice(-60);
  const start = points[0]?.[0] || 0, span = (points[points.length - 1]?.[0] || start) - start;
  return points.map(([time, row]) => ({ ...row, x: span > 0 ? 72 + (time - start) / span * 396 : 270 }));
}
