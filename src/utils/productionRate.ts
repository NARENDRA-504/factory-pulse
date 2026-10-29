import { PersistedSimulatorReading } from '../services/apiClient';

export const estimatePartsPerHour = (history: PersistedSimulatorReading[], sensorName: string) => {
  const byTimestamp = new Map<number, number>();
  for (const reading of history) {
    if (reading.sensor_name.toLowerCase() !== sensorName.toLowerCase()) continue;
    const timestamp = new Date(reading.timestamp).getTime();
    const value = typeof reading.sensor_value === 'number'
      ? reading.sensor_value
      : typeof reading.sensor_value === 'string' && reading.sensor_value.trim() !== ''
        ? Number(reading.sensor_value)
        : Number.NaN;
    if (Number.isFinite(timestamp) && Number.isFinite(value)) byTimestamp.set(timestamp, value);
  }
  const allPoints = Array.from(byTimestamp, ([timestamp, value]) => ({ timestamp, value })).sort((a, b) => a.timestamp - b.timestamp);
  if (allPoints.length < 2) return null;

  const latestTimestamp = allPoints[allPoints.length - 1].timestamp;
  const cutoff = latestTimestamp - 15 * 60 * 1000;
  const points = allPoints.filter((point) => point.timestamp >= cutoff);
  let elapsedMs = 0;
  let producedParts = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const interval = current.timestamp - previous.timestamp;
    const delta = current.value - previous.value;
    // A falling cumulative counter marks a reset; ignore that interval instead of
    // turning the reset into negative production or a misleading hourly rate.
    if (interval <= 0) continue;
    if (delta < 0) {
      // A restarted counter begins a new run; do not mix its rate with the old run.
      elapsedMs = 0;
      producedParts = 0;
      continue;
    }
    elapsedMs += interval;
    producedParts += delta;
  }
  if (elapsedMs < 60 * 1000) return null;
  return { partsPerHour: Math.round(producedParts / elapsedMs * 60 * 60 * 1000), minutesObserved: Math.round(elapsedMs / 60000) };
};

